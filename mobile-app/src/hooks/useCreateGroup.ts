import { useState } from 'react';
import { Alert } from 'react-native';
import i18n from '../i18n';
import { useAuthStore } from '../store/useAuthStore';
import { groupService } from '../services/group.service';
import { getErrorMessage } from '../utils/error';
import { parseAmount } from '../utils/format';

export const useCreateGroup = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [groupId, setGroupId] = useState<string | null>(null);

  const generateInviteCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const createGroup = async (groupName: string, description: string, budgetAmount: string) => {
    if (!groupName.trim()) {
      Alert.alert(i18n.t('common.error'), i18n.t('createGroup.errNoName'));
      return;
    }

    if (!user) {
      Alert.alert(i18n.t('common.error'), i18n.t('createGroup.errNotLoggedIn'));
      return;
    }

    setLoading(true);
    const code = generateInviteCode();

    try {
      const groupData = await groupService.createGroupWithAdmin({
        group_name: groupName.trim(),
        description: description.trim(),
        invite_code: code,
        created_by: user.id,
        budget_amount: budgetAmount ? parseAmount(budgetAmount) : undefined,
      });

      setInviteCode(code);
      if (groupData?.group_id) {
        setGroupId(groupData.group_id);
      }
      return { success: true, code, groupId: groupData?.group_id };
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert(
        i18n.t('common.error'),
        getErrorMessage(error) || i18n.t('createGroup.errFailed')
      );
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  return {
    createGroup,
    loading,
    inviteCode,
    groupId,
  };
};
