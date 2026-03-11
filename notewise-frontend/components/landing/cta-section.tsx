"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function CtaSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center px-4 py-20 text-center lg:px-6 lg:py-28">
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Ready to transform your study workflow?
        </h2>
        <p className="mt-4 max-w-md text-muted-foreground">
          Join students who use NoteWise to study smarter, not harder.
        </p>
        <Link href="/auth" className="mt-8">
          <Button size="lg" className="gap-2 px-8">
            Get started for free
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  )
}
