"use client";

import React from "react";
import { cn } from "@/utils/ui";
import Image from "next/image";
import { type Category } from "@/types/categories";
import { HorizontalScroller } from "@/components/ui/horizontal-scroller";

interface CategoryNavigationProps {
  categories: Category[];
  selectedCategory?: string;
  onCategorySelect: (categoryId: string) => void;
  className?: string;
  showAll?: boolean;
}

export function CategoryNavigation({
  categories,
  selectedCategory,
  onCategorySelect,
  className,
  showAll = false,
}: CategoryNavigationProps) {
  const renderCategoryButton = (category: Category, isScrollable: boolean = false) => (
    <button
      onClick={() => onCategorySelect(category.id)}
      className={cn(
        "relative group overflow-hidden rounded-2xl transition-all duration-500 ease-out",
        "border-2 shadow-sm hover:shadow-xl",
        "transform hover:-translate-y-1",
        isScrollable ? "w-36 h-24" : "w-full h-20 sm:h-24",
        selectedCategory === category.id
          ? "border-primary shadow-lg scale-105 ring-4 ring-primary/10"
          : "border-white/50 hover:border-primary/40 hover:scale-102"
      )}
    >
      {category.bannerUrl ? (
        <Image
          src={category.bannerUrl}
          alt={category.categoryName}
          fill
          className="object-cover transition-transform duration-500 ease-out group-hover:scale-110"
        />
      ) : (
        <div className={cn(
          "w-full h-full transition-all duration-500",
          category.id === ''
            ? "bg-gradient-to-br from-indigo-400 via-purple-500 to-pink-500"
            : "bg-gradient-to-br from-slate-400 via-slate-500 to-slate-600"
        )}>
          <div className="absolute inset-0 opacity-20">
            <div className={cn(
              "absolute bg-white/30 rounded-full",
              isScrollable ? "top-2 left-2 w-4 h-4" : "top-2 left-2 w-3 h-3"
            )}></div>
            <div className={cn(
              "absolute bg-white/40 rounded-full",
              isScrollable ? "bottom-3 right-3 w-2 h-2" : "bottom-2 right-2 w-1.5 h-1.5"
            )}></div>
            <div className={cn(
              "absolute bg-white/20 rounded-full",
              isScrollable ? "top-1/2 right-2 w-1 h-6" : "top-1/2 right-1 w-0.5 h-4"
            )}></div>
          </div>
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-300" />
      
      <div className={cn("absolute inset-0 flex items-center justify-center", isScrollable ? "p-3" : "p-2")}>
        <span className={cn(
          "text-white font-bold text-center leading-tight drop-shadow-lg",
          isScrollable ? "text-sm" : "text-xs"
        )}>
          {category.categoryName}
        </span>
      </div>
      
      {selectedCategory === category.id && (
        <div className={cn("absolute", isScrollable ? "top-2 right-2" : "top-1.5 right-1.5")}>
          <div className="bg-primary rounded-full shadow-lg" style={{ padding: isScrollable ? '6px' : '4px' }}>
            <div className={cn(
              "bg-primary-foreground rounded-full",
              isScrollable ? "w-1.5 h-1.5" : "w-1 h-1"
            )} />
          </div>
        </div>
      )}
      
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className={cn(
          "absolute bg-white/60 rounded-full scale-x-0 group-hover:scale-x-100 transition-transform duration-300 delay-100",
          isScrollable ? "bottom-2 left-2 right-2 h-0.5" : "bottom-1.5 left-1.5 right-1.5 h-0.5"
        )}></div>
      </div>
    </button>
  );

  // Add "All Categories" option at the beginning
  const allCategories = [
    { 
      id: '', 
      categoryName: 'All Categories', 
      bannerUrl: undefined, 
      description: 'Browse all items',
      isActive: true,
      sortOrder: 0,
      createdAt: '',
      updatedAt: ''
    } as Category,
    ...categories
  ];

  if (showAll) {
    // Expanded grid view
    return (
      <div className={cn("w-full", className)}>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
          {allCategories.map((category) => (
            <div key={category.id}>
              {renderCategoryButton(category, false)}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Horizontal scrollable view (default)
  return (
    <HorizontalScroller
      items={allCategories}
      renderItem={(category) => renderCategoryButton(category, true)}
      className={className}
      spacing="space-x-4"
    />
  );
}