// Invitation Service - Business logic for connection invitations

import { BaseService } from './BaseService.js';
import { supabaseAdmin } from '../utils/database.js';
import { ApiResponse } from '../types/common.js';
import { DataMapper } from '../utils/mappers.js';
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

      // Check for pending invitation
      const { data: pendingInvite } = await supabaseAdmin
        .from('connection_invitations')
        .select('id')
        .eq('connection_id', connectionId)
        .eq('invited_email', invitedEmail)
        .eq('status', 'pending')
        .single();

      if (pendingInvite) {
        return {
          success: false,
          error: 'An invitation has already been sent to this email',
        };
      }

      // Create invitation
      const { data, error } = await supabaseAdmin
        .from('connection_invitations')
        .insert({
          connection_id: connectionId,
          invited_email: invitedEmail,
          invited_user_id: existingMember?.id || null,
          invited_by: invitedBy,
          role,
          status: 'pending',
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
          expires_at: inv.expires_at,
          created_at: inv.created_at,
          updated_at: inv.updated_at,
        }),
        connection: DataMapper.toCamelCase(inv.database_connections),
        invitedByUser: DataMapper.toCamelCase(inv.invited_by_user),
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
          expires_at: inv.expires_at,
          created_at: inv.created_at,
          updated_at: inv.updated_at,
        }),
        connection: DataMapper.toCamelCase(inv.database_connections),
        invitedByUser: DataMapper.toCamelCase(inv.invited_by_user),
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
