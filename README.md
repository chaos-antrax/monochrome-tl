# Monochrome TL

Monochrome TL is a private translation portal for managing Chinese web novel translation workflows. It is built for writers, editors, and admins who need to organize novels, translate chapters with AI providers, maintain terminology, and prepare translated content for a separate reader-facing application.

## Features

- **Writer/admin authentication** with role-based access control.
- **Novel library management** for creating, editing, publishing, and deleting novels.
- **Chapter management** with ordering, publishing controls, raw Chinese text, translated text, and translation versions.
- **AI-assisted translation** for novel descriptions and chapters.
- **Provider support** for DeepSeek, OpenRouter, and Z.ai through OpenAI-compatible APIs.
- **Glossary management** with categories, approval states, search, import support, and reader/editor access.
- **Lexicon support** for reinforcing preferred English terminology across translated chapters.
- **Style guides** for reusable translation tone and prose preferences.
- **Reader workspace** with adjustable font size, line height, raw/translated/diff views, and inline editing.
- **Export tools** for TXT, HTML, EPUB, and print/PDF-oriented output.
- **Publishing workflow** for marking novels and specific chapter versions as visible to the reader app.
- **Contribution dashboard** for reviewing reader translation/contribution requests and chatting with accepted contributors.
- **Admin user management** for granting or removing writer access and checking reader activity.
- **Light/dark theme** with a minimal monochrome interface.

## Tech Stack

- Next.js
- React
- TypeScript
- MongoDB
- Tailwind CSS
- Zod
- OpenAI-compatible provider SDK

## Notes

This app is intended to be used as the translation/admin portal. Published novels and chapter versions are stored in the shared MongoDB database so a separate reader app can display only approved public content.

Provider API keys are saved from the Account page and encrypted before storage.
