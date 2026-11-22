image=mcr.microsoft.com/playwright:v1.65.1-noble

container |
  from $image |
  with-directory /src .|
  with-workdir /src |
  with-exec npm install --global bun@1.4.5 |
  with-exec bun install --frozen-lockfile |
  with-exec bun run test | stdout
