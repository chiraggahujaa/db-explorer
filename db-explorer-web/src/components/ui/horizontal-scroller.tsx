"use client";

import React, { useRef, useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/ui";

interface HorizontalScrollerProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  className?: string;
  itemClassName?: string;
  spacing?: string;
  showArrows?: boolean;
  arrowClassName?: string;
  containerPadding?: string;
  scrollPercentage?: number;
}

export function HorizontalScroller<T>({
  items,
  renderItem,
  className,
  itemClassName,
  spacing = "space-x-4",
  showArrows = true,
  arrowClassName,
  containerPadding = "px-12",
  scrollPercentage = 0.8,
}: HorizontalScrollerProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScroll = () => {
    if (!scrollRef.current) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 0);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
  };

  useEffect(() => {
    checkScroll();
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScroll);
      return () => scrollContainer.removeEventListener('scroll', checkScroll);
    }
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    
    const containerWidth = scrollRef.current.clientWidth;
    const scrollAmount = containerWidth * scrollPercentage;
    const newScrollLeft = scrollRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
    
    scrollRef.current.scrollTo({
      left: newScrollLeft,
      behavior: 'smooth'
    });
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={cn("relative", containerPadding, className)}>
      {/* Left arrow */}
      {showArrows && (
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "absolute -left-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full",
            "bg-white/95 backdrop-blur-sm shadow-lg border-2 border-white/20",
            "hover:bg-white hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-300",
            "hover:border-primary/30",
            !canScrollLeft && "opacity-0 pointer-events-none scale-90",
            arrowClassName
          )}
          onClick={() => scroll('left')}
          aria-label="Scroll left"
        >
          <ChevronLeft className="h-5 w-5 text-slate-700" />
        </Button>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className={cn(
          "flex overflow-x-auto scrollbar-hide px-2 py-3",
          spacing
        )}
        style={{ 
          scrollbarWidth: 'none', 
          msOverflowStyle: 'none',
          scrollBehavior: 'smooth'
        }}
      >
        {items.map((item, index) => (
          <div key={index} className={cn("flex-shrink-0", itemClassName)}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>

      {/* Right arrow */}
      {showArrows && (
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "absolute -right-2 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full",
            "bg-white/95 backdrop-blur-sm shadow-lg border-2 border-white/20",
            "hover:bg-white hover:shadow-xl hover:scale-110 active:scale-95 transition-all duration-300",
            "hover:border-primary/30",
            !canScrollRight && "opacity-0 pointer-events-none scale-90",
            arrowClassName
          )}
          onClick={() => scroll('right')}
          aria-label="Scroll right"
        >
          <ChevronRight className="h-5 w-5 text-slate-700" />
        </Button>
      )}
    </div>
  );
}