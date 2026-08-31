"use client"

import Image from "next/image"
import { useMemo, useState } from "react"
import { ImageIcon } from "lucide-react"

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
        "relative flex aspect-[16/9] items-center justify-center overflow-hidden border-b bg-soft-surface",
        className
      )}
      role="img"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-1 bg-primary/50"
      />
      <div className="relative grid justify-items-center gap-2 px-4 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-background text-primary ring-1 ring-border">
          <ImageIcon className="size-5" aria-hidden="true" />
        </span>
        <span className="text-xs font-medium text-muted-foreground">
          Photo unavailable
        </span>
      </div>
    </div>
  )
}

function formatImageCredit(image: ExternalImage) {
  const source = image.source === "wikimedia" ? "Wikimedia" : "Geoapify"

  return image.license === undefined ? source : `${source} - ${image.license}`
}

export { ExternalImageFrame, type ExternalImageFrameState }
