# syntax=docker/dockerfile:1.6

FROM oven/bun:1.4.2 AS base

ENV NEXT_TELEMETRY_DISABLED=1

WORKDIR /app

FROM base AS deps

WORKDIR /app

COPY package.json bun.lock ./

RUN bun install --frozen-lockfile

FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next.js embeds public configuration in the browser bundle during the build.
ARG NEXT_PUBLIC_AAD_TENANT_ID=e2e-tenant
ARG NEXT_PUBLIC_AAD_CLIENT_ID=e2e-client
ARG NEXT_PUBLIC_AAD_REDIRECT_URI=http://localhost:3000
ARG NEXT_PUBLIC_AAD_API_SCOPE=openid,profile
ARG NEXT_PUBLIC_AAD_ATTORNEY_EXTENSION=extension_example_IsAttorney
ARG NEXT_PUBLIC_APPINSIGHTS_CONNECTION_STRING
ARG NEXT_PUBLIC_SUPPORT_EMAIL

ENV APPLICATIONINSIGHTS_DISABLED=true
ENV LEGAL_DOCUMENT_ARCHIVE_PATH=archives/TermsAndAgreements.zip

RUN bun --bun run build:api

FROM builder AS ui-builder

RUN bun run build:ui

FROM base AS static

ENV NODE_ENV=production
ENV PORT=3000
COPY --from=ui-builder --chown=bun:bun /app/out ./out
COPY --chown=bun:bun deploy/static-server.mjs ./deploy/static-server.mjs
EXPOSE 3000
USER bun
CMD ["bun", "deploy/static-server.mjs"]

FROM base AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV PORTAL_API_ONLY=true
ENV PORTAL_LOCAL_DEVELOPMENT=false
ENV LEGAL_DOCUMENT_ARCHIVE_PATH=archives/TermsAndAgreements.zip

COPY --from=builder --chown=bun:bun /app/build/standalone ./
COPY --from=builder --chown=bun:bun /app/build/static ./build/static
COPY --from=builder --chown=bun:bun /app/public ./public
COPY --from=builder --chown=bun:bun /app/archives ./archives
COPY --from=builder --chown=bun:bun /app/lib/terms-of-service-agreements ./lib/terms-of-service-agreements
COPY --chown=bun:bun deploy/keyvault-start.mjs ./keyvault-start.mjs

EXPOSE 3000

USER bun

CMD ["bun", "./keyvault-start.mjs"]
