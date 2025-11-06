export type ItemCondition = 'new' | 'like_new' | 'good' | 'fair' | 'poor';
export type FormCondition = 'new' | 'likeNew' | 'good' | 'fair' | 'poor';

export const ITEM_CONDITIONS = {
  new: {
    value: 'new' as const,
    formValue: 'new' as const,
    label: 'New',
    color: 'bg-green-100 text-green-800 border-green-200'
  },
  like_new: {
    value: 'like_new' as const,
    formValue: 'likeNew' as const,
    label: 'Like New',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  good: {
    value: 'good' as const,
    formValue: 'good' as const,
    label: 'Good',
    color: 'bg-blue-100 text-blue-800 border-blue-200'
  },
  fair: {
    value: 'fair' as const,
    formValue: 'fair' as const,
    label: 'Fair',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200'
  },
  poor: {
    value: 'poor' as const,
    formValue: 'poor' as const,
    label: 'Poor',
    color: 'bg-red-100 text-red-800 border-red-200'
  }
} as const;

export const CONDITION_OPTIONS = Object.values(ITEM_CONDITIONS);

export const getConditionConfig = (condition: ItemCondition | FormCondition) => {
  // Handle both API format (like_new) and form format (likeNew)
  if (condition === 'likeNew') {
    return ITEM_CONDITIONS.like_new;
  }
  return ITEM_CONDITIONS[condition as ItemCondition] || ITEM_CONDITIONS.good;
};