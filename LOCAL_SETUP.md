# Local Environment Setup for CedarGuard

This repository uses [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables) as the source of truth.

## Initial Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/cehpoint-official/cederguard.git
    cd cederguard
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Install Vercel CLI**:
    ```bash
    npm install -g vercel
    ```

4.  **Login to Vercel**:
    ```bash
    vercel login
    ```

5.  **Pull Environment Variables**:
    Linking your local repository to the Vercel project will automatically pull the environment variables for your current environment (development, preview, or production).
    ```bash
    vercel link
    vercel env pull .env.local
    ```

## Manual Configuration (Alternative)

If you cannot use the Vercel CLI, copy the `.env.example` file and fill in the values manually:

```bash
cp .env.example .env.local
```

> [!WARNING]
> Never commit `.env.local` or any other `.env` file containing secrets to the repository. They are already included in `.gitignore`.
