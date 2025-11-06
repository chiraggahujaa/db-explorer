"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/utils/ui";

export interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPageOptions: number[];
  defaultItemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  className?: string;
  scrollTarget?: "top" | "element" | "none";
  scrollElementId?: string;
  scrollOffset?: number;
}

export function Pagination({
  currentPage,
  totalItems,
  itemsPerPageOptions,
  defaultItemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  className,
  scrollTarget = "top",
  scrollElementId,
  scrollOffset = 100,
}: PaginationProps) {
  const itemsPerPage = defaultItemsPerPage;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  const handleScroll = () => {
    if (scrollTarget === "none") return;
    
    if (scrollTarget === "top") {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (scrollTarget === "element" && scrollElementId) {
      const element = document.getElementById(scrollElementId);
      if (element) {
        const elementTop = element.offsetTop - scrollOffset;
        window.scrollTo({
          top: elementTop,
          behavior: 'smooth'
        });
      }
    }
  };

  const handlePageChange = (page: number) => {
    onPageChange(page);
    handleScroll();
  };
  
  // Calculate visible page numbers
  const getVisiblePages = () => {
    const delta = 2;
    const pages: (number | "ellipsis")[] = [];
    
    if (totalPages <= 7) {
      // Show all pages if total is 7 or less
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage <= 4) {
        // Show pages 2-5 and ellipsis + last
        for (let i = 2; i <= 5; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 3) {
        // Show first + ellipsis + last 4 pages
        pages.push("ellipsis");
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        // Show first + ellipsis + current-1, current, current+1 + ellipsis + last
        pages.push("ellipsis");
        for (let i = currentPage - delta; i <= currentPage + delta; i++) {
          pages.push(i);
        }
        pages.push("ellipsis");
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  const visiblePages = getVisiblePages();

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-4", className)}>
      {/* Items per page selector */}
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium text-muted-foreground">Show</p>
        <Select
          value={itemsPerPage.toString()}
          onValueChange={(value) => onItemsPerPageChange(parseInt(value))}
        >
          <SelectTrigger className="h-8 w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent side="top">
            {itemsPerPageOptions.map((pageSize) => (
              <SelectItem key={pageSize} value={pageSize.toString()}>
                {pageSize}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm font-medium text-muted-foreground">
          of {totalItems} results
        </p>
      </div>

      {/* Page navigation - only show if more than 1 page */}
      {totalPages > 1 && (
        <div className="flex items-center space-x-2">
        {/* Previous button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only">Previous page</span>
        </Button>

        {/* Page numbers */}
        <div className="flex items-center space-x-1">
          {visiblePages.map((page, index) => {
            if (page === "ellipsis") {
              return (
                <div
                  key={`ellipsis-${index}`}
                  className="flex h-8 w-8 items-center justify-center"
                >
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                  <span className="sr-only">More pages</span>
                </div>
              );
            }

            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => handlePageChange(page as number)}
                className={cn(
                  "h-8 w-8 p-0",
                  currentPage === page &&
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
              >
                {page}
                <span className="sr-only">
                  {currentPage === page ? "Current page" : `Go to page ${page}`}
                </span>
              </Button>
            );
          })}
        </div>

        {/* Next button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
          <span className="sr-only">Next page</span>
        </Button>
        </div>
      )}
    </div>
  );
}

export default Pagination;