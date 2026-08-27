# Security Policy

## Reporting

If you discover a security vulnerability, please report it responsibly:

- **Email**: [contact via GitHub](https://github.com/daffhaidar/t3n-payroll-agent/issues)
- **DO NOT** open public issues for security vulnerabilities
- **DO NOT** include credentials, API keys, or private keys in reports

## Scope

This project is a demonstration/payroll agent for the Terminal 3 Agent Build Challenge. Security concerns should be directed to:

1. **T3N SDK issues**: Report to Terminal 3 DevRel (https://t.me/terminal3developer)
2. **Contract vulnerabilities**: This is a demo contract, not production payroll software
3. **API key exposure**: Rotate immediately if exposed

## Best Practices

- Never commit `.env` files or API keys
- Use environment variables for all secrets
- Rotate API keys regularly
- Do not share private keys or mnemonics
- Use read-only API keys where possible
