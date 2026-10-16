image=mcr.microsoft.com/playwright:v1.63.0-noble

container |
  from $image |
  with-directory /src .|
  with-workdir /src |
  with-exec npm install --global bun@1.4.3 |
  with-exec bun install --frozen-lockfile |
  with-exec bun run test | stdout
