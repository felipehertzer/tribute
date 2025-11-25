image=mcr.microsoft.com/playwright:v1.56.1-noble

container |
  from $image |
  with-directory /src .|
  with-workdir /src |
  with-exec npm install |
  with-exec npm run test | stdout
