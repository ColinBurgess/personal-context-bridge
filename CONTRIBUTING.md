# Contributing to Personal Context Bridge

Thank you for your interest in contributing! This document outlines the process for contributing to this project.

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- Git

### Setup

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/personal-context-bridge.git
   cd personal-context-bridge
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### 1. Create a Branch

Always create a new branch for each feature or fix:

```bash
git checkout -b feature/my-feature
# or
git checkout -b fix/my-bug
```

### 2. Make Changes

- Keep commits focused and logical
- Run tests locally before pushing:

**Backend tests:**
```bash
pytest -v
```

**Frontend tests:**
```bash
npm --prefix frontend test -- --run
```

### 3. Commit Changes

Use **conventional commit messages**:

```bash
git commit -m "feat: add new authentication endpoint"
git commit -m "fix: resolve memory leak in cache"
git commit -m "docs: update API documentation"
git commit -m "ci: improve GitHub Actions workflow"
git commit -m "chore: update dependencies"
```

**Commit message format:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `perf:` - Performance improvements
- `test:` - Test additions/modifications
- `ci:` - CI/CD changes
- `chore:` - Maintenance, dependencies, etc.

### 4. Push and Create a Pull Request

```bash
git push origin feature/my-feature
```

Then open a **Pull Request** on GitHub:
- Provide a clear title and description
- Reference any related issues
- Ensure all tests pass (CI/CD will verify)

## Requirements

### Tests Must Pass

All pull requests must have:
- ✅ Backend tests passing (`pytest`)
- ✅ Frontend tests passing (`npm test`)

The GitHub Actions workflow will run tests automatically. If tests fail, update your code and push again.

### Code Quality

- Follow the existing code style
- Write clear, descriptive commit messages
- Add tests for new features

## Merge Process

- Only the repository owner can merge pull requests
- Once your PR is reviewed and tests pass, the owner will merge it
- Commits are typically squashed when merging to keep history clean

## Questions?

If you have questions or need help, feel free to open an issue or discussion on GitHub.

---

**Happy contributing!** 🚀
