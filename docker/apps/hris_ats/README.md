### HRIS ATS

Resume Screening and Background Check for ERPNext / Frappe HR

### Installation

You can install this app using the [bench](https://github.com/frappe/bench) CLI:

```bash
cd $PATH_TO_YOUR_BENCH
bench get-app $URL_OF_THIS_REPO --branch feat/hris-ats
bench install-app hris_ats
```

### Contributing

This app uses `pre-commit` for code formatting and linting. Please [install pre-commit](https://pre-commit.com/#installation) and enable it for this repository:

```bash
cd apps/hris_ats
pre-commit install
```

Pre-commit is configured to use the following tools for checking and formatting your code:

- ruff
- eslint
- prettier
- pyupgrade

### License

MIT

### Attribution

Katalog platform publik pada modul Background Check menggunakan data dari dataset terbuka [WhatsMyName](https://github.com/WebBreacher/WhatsMyName) yang dilisensikan di bawah [Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)](https://creativecommons.org/licenses/by-sa/4.0/).
