# Contributing to TOR Chat

Thank you for your interest in contributing to TOR Chat! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to:

- Be respectful and inclusive
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in Issues
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Environment details (OS, Node version, etc.)

### Suggesting Features

1. Check existing issues for similar suggestions
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Possible implementation approach
   - Any potential drawbacks

### Pull Requests

1. **Fork the repository**
   ```bash
   git clone https://github.com/yourusername/tor-chat-app.git
   cd tor-chat-app
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation

4. **Test your changes**
   ```bash
   npm test
   npm run lint
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

   Follow commit message conventions:
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation changes
   - `style:` formatting changes
   - `refactor:` code refactoring
   - `test:` adding tests
   - `chore:` maintenance tasks

6. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create Pull Request**
   - Go to the original repository
   - Click "New Pull Request"
   - Select your branch
   - Fill in the PR template
   - Wait for review

## Development Setup

See [SETUP.md](SETUP.md) for detailed setup instructions.

Quick start:
```bash
npm install
docker-compose up -d
npm run dev:backend
npm run dev:web
```

## Code Style

### TypeScript

- Use TypeScript strict mode
- Prefer `const` over `let`
- Use interfaces for object types
- Document complex functions

### React

- Use functional components with hooks
- Keep components small and focused
- Use meaningful variable names
- Extract reusable logic to custom hooks

### Naming Conventions

- **Files**: `camelCase.ts` or `PascalCase.tsx` for components
- **Functions**: `camelCase`
- **Classes**: `PascalCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Interfaces**: `PascalCase` (without `I` prefix)

## Testing

### Unit Tests

```bash
cd packages/backend
npm test
```

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

```bash
npm run test:e2e
```

## Documentation

When contributing, please update:

- Code comments
- README.md (if adding features)
- API documentation
- CHANGELOG.md

## Project Structure

```
tor-chat-app/
├── packages/
│   ├── backend/       # Node.js backend
│   ├── web/          # React WebUI
│   ├── desktop/      # Electron app
│   └── android/      # React Native app
├── docs/             # Documentation
├── docker-compose.yml
└── README.md
```

## Security Contributions

For security-related contributions:

1. DO NOT create public issues
2. Email security@example.com
3. Allow time for patch before disclosure
4. See [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

- Open a GitHub issue
- Join our Discord/Slack (if available)
- Email support@example.com

## Recognition

Contributors will be recognized in:
- README.md contributors section
- Release notes
- Project website (if applicable)

Thank you for contributing to TOR Chat!
