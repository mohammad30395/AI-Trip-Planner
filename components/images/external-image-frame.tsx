"use client"

import Image from "next/image"
import { useMemo, useState } from "react"

import {
  getExternalImageRenderMode,
  normalizeExternalImage,
  type ExternalImage,
} from "@/lib/images/external-image"
import { cn } from "@/lib/utils"

type ExternalImageFrameState = "loading" | "ready" | "missing" | "error"

function ExternalImageFrame({
  className,
  fallbackLabel,
  image,
  state,
}: {
  className?: string
  fallbackLabel: string
  image: ExternalImage | null | undefined
  state: ExternalImageFrameState
}) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const safeImage = useMemo(
    () =>
      image === null || image === undefined
        ? null
        : normalizeExternalImage(image),
    [image]
  )
  const loadFailed = safeImage?.url === failedImageUrl

  const renderMode = getExternalImageRenderMode({
    image: safeImage,
    isLoading: state === "loading",
    loadFailed,
  })

  if (renderMode === "loading") {
    return (
      <div
        aria-busy="true"
        aria-label={`Loading image for ${fallbackLabel}`}
        className={cn(
          "aspect-[16/9] animate-pulse border-b bg-muted",
          className
        )}
        role="img"
      />
    )
  }

  if (renderMode === "image" && safeImage !== null) {
    return (
      <div className={cn("relative aspect-[16/9] border-b", className)}>
        <Image
          alt={safeImage.alt}
          className="object-cover"
          fill
          loading="lazy"
          referrerPolicy="no-referrer"
          sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          src={safeImage.url}
          onError={() => {
            setFailedImageUrl(safeImage.url)
          }}
        />
        <span className="absolute right-2 bottom-2 max-w-[calc(100%-1rem)] rounded bg-background/85 px-2 py-1 text-[0.65rem] font-medium text-muted-foreground shadow-sm">
          {formatImageCredit(safeImage)}
        </span>
      </div>
    )
  }

  return <ImageFallback className={className} label={fallbackLabel} />
}

function ImageFallback({
  className,
  label,
}: {
  className?: string
  label: string
}) {
  return (
    <div
      aria-label={`No image available for ${label}`}
      className={cn(
        "relative flex aspect-[16/9] items-center justify-center overflow-hidden border-b bg-[linear-gradient(135deg,var(--muted),var(--background)_48%,var(--accent))]",
        className
      )}
      role="img"
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0",
          "bg-[radial-gradient(circle_at_30%_25%,color-mix(in_oklch,var(--primary)_16%,transparent),transparent_32%),radial-gradient(circle_at_78%_72%,color-mix(in_oklch,var(--accent-foreground)_14%,transparent),transparent_34%)]"
        )}
      />
      <svg
        aria-hidden="true"
        className="relative h-12 w-12 text-muted-foreground/60"
        fill="none"
        viewBox="0 0 64 64"
      >
        <path
          d="M10 47 24 31l10 11 7-8 13 13"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="4"
        />
        <circle cx="43" cy="22" r="5" stroke="currentColor" strokeWidth="4" />
        <rect
          height="42"
          rx="7"
          stroke="currentColor"
          strokeWidth="4"
          width="48"
          x="8"
          y="11"
        />
      </svg>
    </div>
  )
}

function formatImageCredit(image: ExternalImage) {
  const source = image.source === "wikimedia" ? "Wikimedia" : "Geoapify"

  return image.license === undefined ? source : `${source} - ${image.license}`
}

export { ExternalImageFrame, type ExternalImageFrameState }
