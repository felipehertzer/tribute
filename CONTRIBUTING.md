## Contributing

We welcome contributions to Tribute. There are many areas where we would love to see community contributions that we have outlined below, but first, let's go over how to develop in Tribute.

Install dependencies with [Bun](https://bun.sh), the repository's package manager (`bun.lock` is the only lockfile):

```sh
bun install
```

Build and start the Vite development server:

```sh
bun run start
```

That's it! Now you can use the `example/index.html` to test out changes to the code base. All changes to `src` will recompile on the fly.

Once you have made your changes, feel free to submit a pull request.

## Testing

We use [Vitest](https://vitest.dev/) in browser mode with Playwright's Chromium.

To run the checks CI runs:

```
bunx playwright install chromium
bun run lint
bun run test:coverage
bun run build
```

## Contribution Ideas

The major focus that we could use your help with is creating wrappers for different JavaScript frameworks. Some of the ones we are interested in are outlined below. We also see a couple of areas for improving compatibility with different rendering situations, such as in iframes inside of rich text editors.

**Some ideas that are for grabs**

- Prosemirror component
- `noMatchTemplate` per collection.
