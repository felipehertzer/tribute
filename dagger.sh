image=mcr.microsoft.com/playwright:v1.65.0-noble

container |
  from $image |
  with-directory /src .|
  with-workdir /src |
  with-exec npm install --global bun@1.4.4 |
  with-exec bun install --frozen-lockfile |
  with-exec bun run test | stdout
