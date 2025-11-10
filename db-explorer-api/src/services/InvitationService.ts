// Invitation Service - Business logic for connection invitations

import { BaseService } from './BaseService.js';
import { supabaseAdmin } from '../utils/database.js';
import { ApiResponse } from '../types/common.js';
import { DataMapper } from '../utils/mappers.js';
import { randomBytes } from 'crypto';
import type {
  ConnectionInvitation,
  InvitationWithDetails,
  ConnectionRole,
} from '../types/connection.js';

export class InvitationService extends BaseService {
  constructor() {
    super('connection_invitations');
  }

  /**
   * Create bulk invitations to a connection
   */
  async createBulkInvitations(
    connectionId: string,
    invitations: Array<{ email: string; role: ConnectionRole }>,
    invitedBy: string
  ): Promise<ApiResponse<{ invitations: ConnectionInvitation[]; errors: Array<{ email: string; error: string }> }>> {
    try {
      // Check if user is owner or admin
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('connection_members')
        .select('role')
        .eq('connection_id', connectionId)
        .eq('user_id', invitedBy)
        .single();

      if (memberError || !memberData) {
        return {
          success: false,
          error: 'Access denied',
        };
      }

      if (!['owner', 'admin'].includes(memberData.role)) {
        return {
          success: false,
          error: 'Only owners and admins can invite members',
        };
      }

      const results: ConnectionInvitation[] = [];
      const errors: Array<{ email: string; error: string }> = [];

      // Process invitations sequentially to avoid race conditions
      for (const { email, role } of invitations) {
        try {
          const result = await this.createInvitation(connectionId, email, role, invitedBy);
          if (result.success && result.data) {
            results.push(result.data);
          } else {
            errors.push({ email, error: result.error || 'Failed to create invitation' });
          }
        } catch (error: any) {
          errors.push({ email, error: error.message || 'Failed to create invitation' });
        }
      }

      return {
        success: true,
        data: {
          invitations: results,
          errors,
        },
        message: `Successfully created ${results.length} invitation(s)${errors.length > 0 ? `, ${errors.length} failed` : ''}`,
      };
    } catch (error) {
      console.error('Error in createBulkInvitations:', error);
      throw error;
    }
  }

  /**
   * Create an invitation to a connection
   */
  async createInvitation(
    connectionId: string,
    invitedEmail: string,
    role: ConnectionRole,
    invitedBy: string
  ): Promise<ApiResponse<ConnectionInvitation>> {
    try {
      // Check if user is owner or admin
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('connection_members')
        .select('role')
        .eq('connection_id', connectionId)
        .eq('user_id', invitedBy)
        .single();

      if (memberError || !memberData) {
        return {
          success: false,
          error: 'Access denied',
        };
      }

      if (!['owner', 'admin'].includes(memberData.role)) {
        return {
          success: false,
          error: 'Only owners and admins can invite members',
        };
      }

      // Check if user is already a member
      const { data: existingMember } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', invitedEmail)
        .single();

      if (existingMember) {
        const { data: memberCheck } = await supabaseAdmin
          .from('connection_members')
          .select('id')
          .eq('connection_id', connectionId)
          .eq('user_id', existingMember.id)
          .single();

        if (memberCheck) {
          return {
            success: false,
            error: 'User is already a member of this connection',
          };
        }
      }

      // Check for existing invitation (pending or expired)
      // First check for pending invitation
      const { data: pendingInvite } = await supabaseAdmin
        .from('connection_invitations')
        .select('id, token, expires_at, status')
        .eq('connection_id', connectionId)
        .eq('invited_email', invitedEmail)
        .eq('status', 'pending')
        .maybeSingle();

      let expiredInvite = null;
      // If no pending invitation, check for most recent expired one
      if (!pendingInvite) {
        const { data } = await supabaseAdmin
          .from('connection_invitations')
          .select('id, token, expires_at, status')
          .eq('connection_id', connectionId)
          .eq('invited_email', invitedEmail)
          .eq('status', 'expired')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        expiredInvite = data;
      }

      const existingInvite = pendingInvite || expiredInvite;

      if (existingInvite) {
        const expiresAt = new Date(existingInvite.expires_at);
        const now = new Date();
        const isExpired = expiresAt < now || existingInvite.status === 'expired';

        if (!isExpired) {
          // Invitation exists and is not expired - return existing invitation
          const { data: invitationData, error: fetchError } = await supabaseAdmin
            .from('connection_invitations')
            .select('*')
            .eq('id', existingInvite.id)
            .single();

          if (fetchError || !invitationData) {
            throw new Error(`Database error: ${fetchError?.message || 'Failed to fetch invitation'}`);
          }

          return {
            success: true,
            data: DataMapper.toCamelCase(invitationData),
            message: 'Invitation already exists',
          };
        } else {
          // Invitation exists but is expired - regenerate token and update expiration
          const newToken = randomBytes(32).toString('hex');
          const newExpiresAt = new Date();
          newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 days from now

          const { data: updatedInvite, error: updateError } = await supabaseAdmin
            .from('connection_invitations')
            .update({
              token: newToken,
              expires_at: newExpiresAt.toISOString(),
              status: 'pending',
              invited_by: invitedBy,
              role,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingInvite.id)
            .select()
            .single();

          if (updateError || !updatedInvite) {
            throw new Error(`Database error: ${updateError?.message || 'Failed to update invitation'}`);
          }

          return {
            success: true,
            data: DataMapper.toCamelCase(updatedInvite),
            message: 'Invitation renewed successfully',
          };
        }
      }

      // Generate secure token (64-character hex string)
      const token = randomBytes(32).toString('hex');

      // Create new invitation
      const { data, error } = await supabaseAdmin
        .from('connection_invitations')
        .insert({
          connection_id: connectionId,
          invited_email: invitedEmail,
          invited_user_id: existingMember?.id || null,
          invited_by: invitedBy,
          role,
          status: 'pending',
          token,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: DataMapper.toCamelCase(data),
        message: 'Invitation sent successfully',
      };
    } catch (error) {
      console.error('Error in createInvitation:', error);
      throw error;
    }
  }

  /**
   * Get all invitations for a connection
   */
  async getConnectionInvitations(
    connectionId: string,
    userId: string
  ): Promise<ApiResponse<InvitationWithDetails[]>> {
    try {
      // Check if user is owner or admin
      const { data: memberData, error: memberError } = await supabaseAdmin
        .from('connection_members')
        .select('role')
        .eq('connection_id', connectionId)
        .eq('user_id', userId)
        .single();

      if (memberError || !memberData) {
        return {
          success: false,
          error: 'Access denied',
        };
      }

      if (!['owner', 'admin'].includes(memberData.role)) {
        return {
          success: false,
          error: 'Only owners and admins can view invitations',
        };
      }

      const { data, error } = await supabaseAdmin
        .from('connection_invitations')
        .select(
          `
          *,
          database_connections (
            id,
            name,
            db_type
          ),
          invited_by_user:users!connection_invitations_invited_by_fkey (
            id,
            email,
            full_name
          )
        `
        )
        .eq('connection_id', connectionId)
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const invitations: InvitationWithDetails[] = (data || []).map((inv: any) => ({
        ...DataMapper.toCamelCase({
          id: inv.id,
          connection_id: inv.connection_id,
          invited_email: inv.invited_email,
          invited_user_id: inv.invited_user_id,
          invited_by: inv.invited_by,
          role: inv.role,
          status: inv.status,
          token: inv.token,
          expires_at: inv.expires_at,
          created_at: inv.created_at,
          updated_at: inv.updated_at,
        }),
        connection: DataMapper.toCamelCase(inv.database_connections),
        invited_by_user: DataMapper.toCamelCase(inv.invited_by_user),
      }));

      return {
        success: true,
        data: invitations,
      };
    } catch (error) {
      console.error('Error in getConnectionInvitations:', error);
      throw error;
    }
  }

  /**
   * Get all invitations for a user
   */
  async getUserInvitations(userId: string): Promise<ApiResponse<InvitationWithDetails[]>> {
    try {
      // Get user email
      const { data: userData, error: userError } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userError) {
        throw new Error(`Database error: ${userError.message}`);
      }

      const { data, error } = await supabaseAdmin
        .from('connection_invitations')
        .select(
          `
          *,
          database_connections (
            id,
            name,
            db_type
          ),
          invited_by_user:users!connection_invitations_invited_by_fkey (
            id,
            email,
            full_name
          )
        `
        )
        .eq('invited_email', userData.email)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      const invitations: InvitationWithDetails[] = (data || []).map((inv: any) => ({
        ...DataMapper.toCamelCase({
          id: inv.id,
          connection_id: inv.connection_id,
          invited_email: inv.invited_email,
          invited_user_id: inv.invited_user_id,
          invited_by: inv.invited_by,
          role: inv.role,
          status: inv.status,
          token: inv.token,
          expires_at: inv.expires_at,
          created_at: inv.created_at,
          updated_at: inv.updated_at,
        }),
        connection: DataMapper.toCamelCase(inv.database_connections),
        invited_by_user: DataMapper.toCamelCase(inv.invited_by_user),
      }));

      return {
        success: true,
        data: invitations,
      };
    } catch (error) {
      console.error('Error in getUserInvitations:', error);
      throw error;
    }
  }

  /**
   * Get invitation by token
   */
  async getInvitationByToken(token: string): Promise<ApiResponse<InvitationWithDetails>> {
    try {
      const { data, error } = await supabaseAdmin
        .from('connection_invitations')
        .select(
          `
          *,
          database_connections (
            id,
            name,
            db_type
          ),
          invited_by_user:users!connection_invitations_invited_by_fkey (
            id,
            email,
            full_name
          )
        `
        )
        .eq('token', token)
        .single();

      if (error || !data) {
        return {
          success: false,
          error: 'Invitation not found',
        };
      }

      // Check if invitation is expired
      if (new Date(data.expires_at) < new Date()) {
        // Update status to expired if still pending
        if (data.status === 'pending') {
          await supabaseAdmin
            .from('connection_invitations')
            .update({ status: 'expired' })
            .eq('id', data.id);
        }
        return {
          success: false,
          error: 'Invitation has expired',
        };
      }

      // Check if invitation is still pending
      if (data.status !== 'pending') {
        return {
          success: false,
          error: `Invitation has already been ${data.status}`,
        };
      }

      // Fetch user data if join didn't work
      let invitedByUser = data.invited_by_user;
      if (!invitedByUser && data.invited_by) {
        const { data: userData } = await supabaseAdmin
          .from('users')
          .select('id, email, full_name')
          .eq('id', data.invited_by)
          .single();
        invitedByUser = userData || null;
      }

      // Fetch connection data if join didn't work
      let connectionData = data.database_connections;
      if (!connectionData && data.connection_id) {
        const { data: connData } = await supabaseAdmin
          .from('database_connections')
          .select('id, name, db_type')
          .eq('id', data.connection_id)
          .single();
        connectionData = connData || null;
      }

      const invitation: InvitationWithDetails = {
        ...DataMapper.toCamelCase({
          id: data.id,
          connection_id: data.connection_id,
          invited_email: data.invited_email,
          invited_user_id: data.invited_user_id,
          invited_by: data.invited_by,
          role: data.role,
          status: data.status,
          token: data.token,
          expires_at: data.expires_at,
          created_at: data.created_at,
          updated_at: data.updated_at,
        }),
        connection: connectionData ? DataMapper.toCamelCase(connectionData) : null,
        invited_by_user: invitedByUser ? DataMapper.toCamelCase(invitedByUser) : null,
      };

      return {
        success: true,
        data: invitation,
      };
    } catch (error) {
      console.error('Error in getInvitationByToken:', error);
      throw error;
    }
  }

  /**
   * Accept an invitation by token
   */
  async acceptInvitationByToken(
    token: string,
    userId: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // Get invitation by token
      const invitationResult = await this.getInvitationByToken(token);
      if (!invitationResult.success || !invitationResult.data) {
        return invitationResult as any;
      }

      const invitation = invitationResult.data;

      // Verify user email matches invitation (handle both camelCase and snake_case)
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      const invitedEmail = (invitation as any).invitedEmail || (invitation as any).invited_email;
      
      if (!userData?.email) {
        return {
          success: false,
          error: 'User not found',
        };
      }

      if (userData.email !== invitedEmail) {
        return {
          success: false,
          error: 'This invitation is not for you',
        };
      }

      // Add user as member (handle both camelCase and snake_case)
      const connectionId = (invitation as any).connectionId || (invitation as any).connection_id;
      const invitedBy = (invitation as any).invitedBy || (invitation as any).invited_by;
      
      const { error: memberError } = await supabaseAdmin.from('connection_members').insert({
        connection_id: connectionId,
        user_id: userId,
        role: invitation.role,
        added_by: invitedBy,
      });

      if (memberError) {
        throw new Error(`Database error: ${memberError.message}`);
      }

      // Update invitation status
      await supabaseAdmin
        .from('connection_invitations')
        .update({ status: 'accepted' })
        .eq('id', (invitation as any).id);

      return {
        success: true,
        data: { success: true },
        message: 'Invitation accepted successfully',
      };
    } catch (error) {
      console.error('Error in acceptInvitationByToken:', error);
      throw error;
    }
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(
    invitationId: string,
    userId: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // Get invitation details
      const { data: invitation, error: invError } = await supabaseAdmin
        .from('connection_invitations')
        .select('*, users!inner(email)')
        .eq('id', invitationId)
        .single();

      if (invError || !invitation) {
        return {
          success: false,
          error: 'Invitation not found',
        };
      }

      // Verify user email matches invitation
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userData?.email !== invitation.invited_email) {
        return {
          success: false,
          error: 'This invitation is not for you',
        };
      }

      // Check if invitation is still valid
      if (invitation.status !== 'pending') {
        return {
          success: false,
          error: `Invitation has already been ${invitation.status}`,
        };
      }

      if (new Date(invitation.expires_at) < new Date()) {
        // Update status to expired
        await supabaseAdmin
          .from('connection_invitations')
          .update({ status: 'expired' })
          .eq('id', invitationId);

        return {
          success: false,
          error: 'Invitation has expired',
        };
      }

      // Add user as member
      const { error: memberError } = await supabaseAdmin.from('connection_members').insert({
        connection_id: invitation.connection_id,
        user_id: userId,
        role: invitation.role,
        added_by: invitation.invited_by,
      });

      if (memberError) {
        throw new Error(`Database error: ${memberError.message}`);
      }

      // Update invitation status
      await supabaseAdmin
        .from('connection_invitations')
        .update({ status: 'accepted' })
        .eq('id', invitationId);

      return {
        success: true,
        data: { success: true },
        message: 'Invitation accepted successfully',
      };
    } catch (error) {
      console.error('Error in acceptInvitation:', error);
      throw error;
    }
  }

  /**
   * Decline an invitation
   */
  async declineInvitation(
    invitationId: string,
    userId: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // Get invitation details
      const { data: invitation, error: invError } = await supabaseAdmin
        .from('connection_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();

      if (invError || !invitation) {
        return {
          success: false,
          error: 'Invitation not found',
        };
      }

      // Verify user email matches invitation
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      if (userData?.email !== invitation.invited_email) {
        return {
          success: false,
          error: 'This invitation is not for you',
        };
      }

      // Update invitation status
      const { error } = await supabaseAdmin
        .from('connection_invitations')
        .update({ status: 'declined' })
        .eq('id', invitationId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: { success: true },
        message: 'Invitation declined',
      };
    } catch (error) {
      console.error('Error in declineInvitation:', error);
      throw error;
    }
  }

  /**
   * Cancel an invitation (by the person who sent it)
   */
  async cancelInvitation(
    invitationId: string,
    userId: string
  ): Promise<ApiResponse<{ success: boolean }>> {
    try {
      // Get invitation details
      const { data: invitation, error: invError } = await supabaseAdmin
        .from('connection_invitations')
        .select('*')
        .eq('id', invitationId)
        .single();

      if (invError || !invitation) {
        return {
          success: false,
          error: 'Invitation not found',
        };
      }

      // Check if user is owner or admin of the connection
      const { data: memberData } = await supabaseAdmin
        .from('connection_members')
        .select('role')
        .eq('connection_id', invitation.connection_id)
        .eq('user_id', userId)
        .single();

      if (!memberData || !['owner', 'admin'].includes(memberData.role)) {
        return {
          success: false,
          error: 'Permission denied',
        };
      }

      // Delete the invitation
      const { error } = await supabaseAdmin
        .from('connection_invitations')
        .delete()
        .eq('id', invitationId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        success: true,
        data: { success: true },
        message: 'Invitation cancelled',
      };
    } catch (error) {
      console.error('Error in cancelInvitation:', error);
      throw error;
    }
  }
}
