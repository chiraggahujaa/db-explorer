"use client";

import React, { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/ui";
import Image from "next/image";

interface ImageData {
  file: {
    url: string;
  };
  isPrimary: boolean;
  displayOrder: number;
}

interface ImageCarouselProps {
  images: ImageData[];
  alt?: string;
  className?: string;
  aspectRatio?: "square" | "video" | "wide" | string;
  showDots?: boolean;
  showArrows?: boolean;
  autoSlide?: boolean;
  autoSlideInterval?: number;
  width?: number | string;
  height?: number | string;
}

export function ImageCarousel({
  images,
  alt = "Image",
  className,
  aspectRatio = "video",
  showDots = true,
  showArrows = true,
  autoSlide = false,
  autoSlideInterval = 3000,
  width = "100%",
  height = "auto",
}: ImageCarouselProps) {
  // Sort images: primary first, then by displayOrder
  const sortedImages = [...images].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.displayOrder - b.displayOrder;
  });

  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto slide functionality
  React.useEffect(() => {
    if (!autoSlide || sortedImages.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
    }, autoSlideInterval);

    return () => clearInterval(interval);
  }, [autoSlide, autoSlideInterval, sortedImages.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => 
      prev === 0 ? sortedImages.length - 1 : prev - 1
    );
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % sortedImages.length);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  if (!sortedImages.length) {
    return (
      <div 
        className={cn(
          "bg-gradient-to-br from-slate-300 via-slate-400 to-slate-500",
          getAspectRatioClass(aspectRatio),
          className
        )}
        style={{ width, height }}
      />
    );
  }

  if (sortedImages.length === 1) {
    return (
      <div 
        className={cn("relative overflow-hidden", getAspectRatioClass(aspectRatio), className)}
        style={{ width, height }}
      >
        <Image
          src={sortedImages[0].file.url}
          alt={alt}
          fill
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div 
      className={cn("relative overflow-hidden group", getAspectRatioClass(aspectRatio), className)}
      style={{ width, height }}
    >
      {/* Image Container with smooth transitions */}
      <div className="relative w-full h-full">
        {sortedImages.map((image, index) => (
          <Image
            key={index}
            src={image.file.url}
            alt={`${alt} ${index + 1}`}
            fill
            className={cn(
              "object-cover transition-all duration-500 ease-in-out",
              index === currentIndex
                ? "opacity-100 scale-100"
                : "opacity-0 scale-105"
            )}
            style={{
              transitionDelay: index === currentIndex ? "0ms" : "150ms"
            }}
          />
        ))}
      </div>

      {/* Navigation Arrows */}
      {showArrows && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 hover:scale-110 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out z-10"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-4 h-4 transition-transform duration-100" />
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 hover:scale-110 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 ease-out z-10"
            aria-label="Next image"
          >
            <ChevronRight className="w-4 h-4 transition-transform duration-100" />
          </button>
        </>
      )}

      {/* Dots Indicator */}
      {showDots && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex space-x-1.5 z-10">
          {sortedImages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-300 ease-out",
                currentIndex === index
                  ? "bg-white scale-125 shadow-lg"
                  : "bg-white/60 hover:bg-white/80 hover:scale-110"
              )}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Image Counter */}
      <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full">
        {currentIndex + 1} / {sortedImages.length}
      </div>
    </div>
  );
}

function getAspectRatioClass(aspectRatio: string) {
  switch (aspectRatio) {
    case "square":
      return "aspect-square";
    case "video":
      return "aspect-video";
    case "wide":
      return "aspect-[16/9]";
    default:
      return aspectRatio.startsWith("aspect-") ? aspectRatio : `aspect-[${aspectRatio}]`;
  }
}

export default ImageCarousel;