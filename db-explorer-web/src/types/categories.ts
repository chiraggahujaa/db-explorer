export interface Category {
  id: string;
  categoryName: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  parentCategoryId?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Relations (if any)
  parentCategory?: Category;
  subcategories?: Category[];
  itemCount?: number;
}