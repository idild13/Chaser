#!/usr/bin/env node

const fs = require("fs");
const Module = require("module");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");
const chromium = require("@sparticuz/chromium");
const { PDFDocument } = require("pdf-lib");
const puppeteer = require("puppeteer-core");
const ts = require("typescript");

const ROOT = path.resolve(__dirname, "..");

function loadProductionGenerator() {
  const generatorPath = path.join(ROOT, "utils", "generateInvoicePDF.ts");
  const source = fs.readFileSync(generatorPath, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: generatorPath,
  }).outputText;

  const fixtureModule = new Module(generatorPath, module);
  fixtureModule.filename = generatorPath;
  fixtureModule.paths = Module._nodeModulePaths(ROOT);
  fixtureModule.require = (request) => {
    if (request === "@/context/InvoicesContext") {
      return {
        computeInvoiceTotals(invoice) {
          const subtotal = invoice.lineItems.reduce(
            (sum, item) => sum + item.quantity * item.unitPrice,
            0,
          );
          const discount =
            invoice.discountType === "fixed"
              ? invoice.discountValue || 0
              : subtotal * ((invoice.discountValue || 0) / 100);
          const taxableBase = subtotal - discount;
          const tax = taxableBase * ((invoice.taxRate || 0) / 100);
          const total = taxableBase + tax;
          const amountPaid = invoice.amountPaid || 0;
          return {
            subtotal,
            discount,
            taxableBase,
            tax,
            total,
            amountPaid,
            balanceDue: Math.max(0, total - amountPaid),
          };
        },
        getEffectiveStatus: (invoice) => invoice.status,
      };
    }
    if (request === "@/context/BusinessProfileContext") {
      return {
        DEFAULT_PROFILE: {
          name: "",
          email: "",
          address: "",
          vatNumber: "",
          bankDetails: "",
          payLink: "",
          logoUri: "",
          defaultCurrency: "EUR",
          defaultPaymentTerms: "Net-30",
          defaultTaxRate: 0,
          numberFormat: "comma-dot",
          invoiceNotes: "",
        },
      };
    }
    if (request === "@/utils/currency") {
      return {
        formatMoney: (value, currency) =>
          new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
          }).format(value),
      };
    }
    if (request === "@/utils/date") {
      return {
        formatDisplayDate: (value) => {
          const [year, month, day] = String(value).slice(0, 10).split("-");
          return `${day}/${month}/${year}`;
        },
      };
    }
    if (
      request === "expo-print" ||
      request === "expo-sharing" ||
      request === "expo-file-system/legacy"
    ) {
      return {};
    }
    if (request === "react-native") {
      return { Platform: { OS: "web" } };
    }
    return Module.prototype.require.call(fixtureModule, request);
  };
  fixtureModule._compile(compiled, generatorPath);
  return fixtureModule.exports.buildInvoiceHTML;
}

async function main() {
  const buildInvoiceHTML = loadProductionGenerator();
  if (typeof buildInvoiceHTML !== "function") {
    throw new Error("Production invoice HTML generator could not be loaded");
  }

  const invoice = {
    id: "pdf-layout-fixture",
    client: "Brightwave Media Group",
    clientEmail: "accounts@brightwave.example",
    clientStreet: "42 Market Street",
    clientPostcode: "10115",
    clientCity: "Berlin",
    clientCountry: "Germany",
    invnum: "INV-2026-0142",
    poNumber: "PO-4821",
    lineItems: [
      {
        id: "project",
        description: "Brand strategy and campaign delivery",
        quantity: 1,
        unitPrice: 2400,
        billingType: "project",
      },
      {
        id: "hour",
        description: "Campaign performance review",
        quantity: 6,
        unitPrice: 125,
        billingType: "hour",
      },
    ],
    currency: "EUR",
    taxRate: 19,
    paymentTerms: "Net-30",
    due: "2026-10-07",
    status: "pending",
    amountPaid: 0,
    createdAt: "2026-09-07",
  };
  const profile = {
    name: "Chaser Studio",
    email: "hello@chaser.example",
    address: "12 Creative Lane\n10117 Berlin, Germany",
    vatNumber: "DE123456789",
    bankDetails: "IBAN DE00 0000 0000 0000 0000 00\nBIC CHASERXX",
    payLink: "",
    logoUri: "",
    defaultCurrency: "EUR",
    defaultPaymentTerms: "Net-30",
    defaultTaxRate: 19,
    numberFormat: "comma-dot",
    invoiceNotes:
      "Business Notes: Thank you for your business. Please include the invoice number with your bank transfer.",
  };

  let html = buildInvoiceHTML(invoice, profile, { webPrint: true });
  for (const requiredText of ["Business Notes:", "Per Project", "Per Hour"]) {
    if (!html.includes(requiredText)) {
      throw new Error(`Invoice fixture is missing required content: ${requiredText}`);
    }
  }
  if (process.env.INVOICE_PDF_TEST_FORCE_TWO_PAGES === "1") {
    html = html.replace(
      "</body>",
      '<div style="break-before: page">Intentional second page</div></body>',
    );
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "invoice-layout-"));
  const htmlPath = path.join(tempDir, "invoice.html");
  const pdfPath = path.join(tempDir, "invoice.pdf");
  fs.writeFileSync(htmlPath, html);

  try {
    const systemChromium = ["chromium", "chromium-browser", "google-chrome"]
      .map((command) =>
        spawnSync("sh", ["-c", `command -v ${command}`], { encoding: "utf8" }),
      )
      .find((result) => result.status === 0)?.stdout.trim();
    const userDataDir = path.join(tempDir, "chromium-profile");
    const browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: systemChromium || (await chromium.executablePath()),
      headless: true,
      userDataDir,
    });
    try {
      const page = await browser.newPage();
      await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
      });
    } finally {
      await browser.close();
    }

    const pdf = await PDFDocument.load(fs.readFileSync(pdfPath));
    const pages = pdf.getPageCount();
    if (pages !== 1) {
      throw new Error(
        `Standard invoice PDF must be exactly 1 page; rendered ${pages || "unknown"}`,
      );
    }
    console.log("✓ Standard invoice PDF layout is exactly one page");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`✗ Invoice PDF layout check failed: ${error.message}`);
  process.exit(1);
});