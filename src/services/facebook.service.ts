import axios, { AxiosError } from 'axios';
import { AppError } from '../utils/error.util';
import { Post } from '../models/post.model';
import { Comment } from '../models/comment.model';
import { Fanpage } from '../models/fanpage.model';
import { Message } from '../models/message.model';
import { NotificationService } from './notification.service';
export interface Fanpage {
    pageId: string;
    name: string;
    access_token: string;
    picture?: string;
    category?: string;
}
interface FacebookPost {
    id: string;
    message?: string;
    created_time: string;
    updated_time: string;
    full_picture?: string;
    likes?: { summary: { total_count: number } };
    shares?: { count: number };
    comments?: { summary: { total_count: number } };
}
interface FacebookMessage {
    message_id: string;
}

interface FacebookComment {
    id: string;
    message: string;
    created_time: string;
    from: {
        id: string;
        name: string;
        picture?: { data: { url: string } };
    };
    parent?: { id: string };
    is_hidden?: boolean;
}
export class FacebookService {
    private static readonly FB_API_VERSION = 'v23.0';
    private static readonly FB_API_URL = `https://graph.facebook.com/${FacebookService.FB_API_VERSION}`;

    static async getPosts(pageId: string, accessToken: string): Promise<FacebookPost[]> {
        try {
            const response = await axios.get<{ data: FacebookPost[] }>(`${this.FB_API_URL}/${pageId}/posts`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,message,created_time,updated_time,full_picture,likes.summary(true),shares,comments.summary(true)',
                    limit: 100,
                },
            });
            return response.data.data;
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to get posts',
                error.response?.status || 500
            );
        }
    }
    static async getPageDetails(pageId: string, userAccessToken: string) {
        try {
            const response = await axios.get(`${this.FB_API_URL}/${pageId}`, {
                params: {
                    access_token: userAccessToken,
                    fields: 'id,name,access_token,category,picture'
                }
            });

            return response.data;
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to get page details',
                error.response?.status || 500
            );
        }
    }

    static async getUserPages(userAccessToken: string): Promise<Fanpage[]> {
        try {
            const response = await axios.get(`${this.FB_API_URL}/me/accounts`, {
                params: {
                    access_token: userAccessToken,
                    fields: "id,name,access_token,category,picture{url}", // Thêm access_token và picture.url
                },
            });

            // Chuẩn hóa dữ liệu trả về
            return response.data.data.map((page: any) => ({
                pageId: page.id,
                name: page.name,
                access_token: page.access_token,
                category: page.category,
                picture: page.picture?.data?.url || undefined,
            }));
        } catch (error: any) {
            console.error("Error fetching user pages:", {
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw new AppError(
                error.response?.data?.error?.message || "Không thể lấy danh sách fanpage",
                error.response?.status || 500
            );
        }
    }

    static async syncPageData(pageId: string, accessToken: string) {
        await Promise.all([
            this.syncPosts(pageId, accessToken),
            this.syncComments(pageId, accessToken),
            this.syncMessages(pageId, accessToken)
        ]);
    }

    private static async syncPosts(pageId: string, accessToken: string) {
        try {
            const response = await axios.get(`${this.FB_API_URL}/${pageId}/posts`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,message,attachments,created_time,updated_time,likes.summary(true),shares,comments.summary(true)',
                    limit: 100
                }
            });

            const fanpage = await Fanpage.findOne({ pageId });
            if (!fanpage) throw new AppError('Fanpage not found', 404);

            for (const post of response.data.data) {
                await Post.findOneAndUpdate(
                    { postId: post.id },
                    {
                        fanpageId: fanpage._id,
                        content: post.message || '',
                        attachments: post.attachments?.data?.map((att: any) => ({
                            type: att.type,
                            url: att.url
                        })),
                        createdTime: new Date(post.created_time),
                        updatedTime: new Date(post.updated_time),
                        likes: post.likes?.summary?.total_count,
                        shares: post.shares?.count,
                        commentsCount: post.comments?.summary?.total_count
                    },
                    { upsert: true, new: true }
                );
            }

            return response.data;
        } catch (error: any) {
            console.error('Error syncing posts:', error.response?.data || error);
            throw error;
        }
    }
    private static async syncComments(pageId: string, accessToken: string) {
        try {
            const response = await axios.get(`${this.FB_API_URL}/${pageId}/feed`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,comments{id,from,message,attachment,created_time}',
                    limit: 100
                }
            });

            const fanpage = await Fanpage.findOne({ pageId });
            if (!fanpage) throw new AppError('Fanpage not found', 404);

            for (const post of response.data.data) {
                if (post.comments?.data) {
                    for (const comment of post.comments.data) {
                        const isNewComment = !(await Comment.findOne({ commentId: comment.id }));
                        await Comment.findOneAndUpdate(
                            { commentId: comment.id },
                            {
                                postId: (await Post.findOne({ postId: post.id }))?._id,
                                fanpageId: fanpage._id,
                                fromId: comment.from.id,
                                fromName: comment.from.name,
                                message: comment.message,
                                attachments: comment.attachment
                                    ? [{ type: comment.attachment.type, url: comment.attachment.url }]
                                    : [],
                                createdTime: new Date(comment.created_time)
                            },
                            { upsert: true, new: true }
                        );

                        if (isNewComment) {
                            await NotificationService.createAndSendNotification({
                                userId: fanpage.userId.toString(),
                                type: 'comment',
                                title: 'New Comment',
                                content: `New comment on post ${post.id} from ${comment.from.name}`,
                                relatedId: comment.id
                            });
                        }
                    }
                }
            }

            return response.data;
        } catch (error: any) {
            console.error('Error syncing comments:', error.response?.data || error);
            throw error;
        }
    }
    static async refreshUserAccessToken(userAccessToken: string) {
        try {
            const response = await axios.get(`https://graph.facebook.com/oauth/access_token`, {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: process.env.FB_APP_ID,
                    client_secret: process.env.FB_APP_SECRET,
                    fb_exchange_token: userAccessToken
                }
            });
            return response.data;
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to refresh user access token',
                error.response?.status || 500
            );
        }
    }

    private static async syncMessages(pageId: string, accessToken: string) {
        try {
            const response = await axios.get(`${this.FB_API_URL}/${pageId}/conversations`, {
                params: {
                    access_token: accessToken,
                    fields: 'messages{id,message,attachments,from,created_time}',
                    limit: 100
                }
            });

            const fanpage = await Fanpage.findOne({ pageId });
            if (!fanpage) throw new AppError('Fanpage not found', 404);

            for (const conversation of response.data.data) {
                for (const message of conversation.messages.data) {
                    await Message.findOneAndUpdate(
                        { messageId: message.id },
                        {
                            fanpageId: fanpage._id,
                            conversationId: conversation.id,
                            fromId: message.from.id,
                            fromName: message.from.name,
                            message: message.message,
                            attachments: message.attachments?.data?.map((att: any) => ({
                                type: att.type,
                                url: att.url
                            })),
                            createdTime: new Date(message.created_time)
                        },
                        { upsert: true, new: true }
                    );

                    if (message.from.id !== pageId) {
                        await NotificationService.createAndSendNotification({
                            userId: fanpage.userId.toString(),
                            type: 'message',
                            title: 'New Message',
                            content: `New message from ${message.from.name} in conversation ${conversation.id}`,
                            relatedId: message.id
                        });
                    }
                }
            }

            return response.data;
        } catch (error: any) {
            console.error('Error syncing messages:', error.response?.data || error);
            throw error;
        }
    }

    static async sendMessage(recipientId: string, message: string, accessToken: string): Promise<FacebookMessage> {
        try {
            const response = await axios.post<{ message_id: string }>(
                `${this.FB_API_URL}/${recipientId}/messages`,
                { message: { text: message } },
                { params: { access_token: accessToken } }
            );
            return { message_id: response.data.message_id };
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Không thể gửi tin nhắn',
                error.response?.status || 500
            );
        }
    }

    static async refreshPageAccessToken(pageId: string, userAccessToken: string) {
        try {
            const response = await axios.get(`${this.FB_API_URL}/${pageId}`, {
                params: {
                    access_token: userAccessToken,
                    fields: 'access_token'
                }
            });

            const fanpage = await Fanpage.findOneAndUpdate(
                { pageId },
                { accessToken: response.data.access_token },
                { new: true }
            );

            if (!fanpage) throw new AppError('Fanpage not found', 404);
            return fanpage;
        } catch (error: any) {
            throw new AppError(
                'Failed to refresh access token',
                error.response?.status || 500
            );
        }
    }

    // Thêm phương thức createPost
    static async createPost(pageId: string, message: string, accessToken: string) {
        try {
            const response = await axios.post(
                `${this.FB_API_URL}/${pageId}/feed`,
                {
                    message
                },
                {
                    params: {
                        access_token: accessToken
                    }
                }
            );

            return response.data; // Trả về { id: "post_id" }
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to create post',
                error.response?.status || 500
            );
        }
    }

    // Thêm phương thức updatePost
    static async updatePost(postId: string, message: string, accessToken: string) {
        try {
            const response = await axios.post(
                `${this.FB_API_URL}/${postId}`,
                {
                    message
                },
                {
                    params: {
                        access_token: accessToken
                    }
                }
            );

            return response.data; // Trả về { success: true }
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to update post',
                error.response?.status || 500
            );
        }
    }

    // Thêm phương thức deletePost
    static async deletePost(postId: string, accessToken: string) {
        try {
            const response = await axios.delete(`${this.FB_API_URL}/${postId}`, {
                params: {
                    access_token: accessToken
                }
            });

            return response.data; // Trả về { success: true }
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to delete post',
                error.response?.status || 500
            );
        }
    }

    static async getComments(postId: string, accessToken: string): Promise<FacebookComment[]> {
        try {
            const response = await axios.get<{ data: FacebookComment[] }>(`${this.FB_API_URL}/${postId}/comments`, {
                params: {
                    access_token: accessToken,
                    fields: 'id,message,created_time,from,parent,is_hidden',
                    limit: 100,
                },
            });
            return response.data.data;
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to get comments',
                error.response?.status || 500
            );
        }
    }

    static async replyToComment(commentId: string, message: string, accessToken: string): Promise<FacebookComment> {
        try {
            const response = await axios.post<{ id: string }>(
                `${this.FB_API_URL}/${commentId}/comments`,
                { message },
                { params: { access_token: accessToken } }
            );
            return { id: response.data.id, message, created_time: new Date().toISOString(), from: { id: '', name: '' } };
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to reply to comment',
                error.response?.status || 500
            );
        }
    }

    static async hideComment(commentId: string, accessToken: string, isHidden: boolean): Promise<void> {
        try {
            await axios.post(
                `${this.FB_API_URL}/${commentId}`,
                { is_hidden: isHidden },
                { params: { access_token: accessToken } }
            );
        } catch (error: any) {
            throw new AppError(
                error.response?.data?.error?.message || 'Failed to hide comment',
                error.response?.status || 500
            );
        }
    }
}