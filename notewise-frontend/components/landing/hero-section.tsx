"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Sparkles } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle decorative background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 pb-20 pt-24 text-center lg:px-6 lg:pb-28 lg:pt-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-4 py-1.5 text-sm text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          AI-powered study artifacts
        </div>

        <h1 className="max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Collect sources. Generate
          <span className="text-primary"> study artifacts.</span>
        </h1>

        <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
          NoteWise helps students collect sources and generate concise study artifacts. Upload anything, get summaries, quizzes, narration, and more.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <Link href="/auth">
            <Button size="lg" className="gap-2 px-8">
              Get started
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/auth">
            <Button variant="outline" size="lg" className="px-8 bg-transparent">
              Sign in
            </Button>
          </Link>
        </div>
      </div>
    </section>
  )
}
