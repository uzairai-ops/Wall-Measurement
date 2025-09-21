import { type NextRequest, NextResponse } from "next/server";

interface Material {
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

interface QuotationData {
  materials: Material[];
  subtotal: number;
  laborCost: number;
  equipmentCost: number;
  overhead: number;
  totalCost: number;
  projectName: string;
  date: string;
}

export async function POST(request: NextRequest) {
  try {
    const {
      quotation,
     
    }: { quotation: QuotationData; videoName: string } = await request.json();

    if (!quotation) {
      return NextResponse.json(
        { error: "Invalid quotation data" },
        { status: 400 }
      );
    }

    // Try Puppeteer first, fallback to HTML if it fails
    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.default.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.setContent(generateProfessionalHTML(quotation), {
        waitUntil: "networkidle0",
      });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20mm", right: "15mm", bottom: "20mm", left: "15mm" },
      });

      await browser.close();

      // Convert Buffer/Uint8Array to ReadableStream for NextResponse
      const { Readable } = await import("stream");
      const stream = Readable.from(pdfBuffer);

      return new NextResponse(stream as unknown as ReadableStream<Uint8Array>, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="quotation-${Date.now()}.pdf"`,
        },
      });
    } catch {
      // Fallback to HTML download
      const htmlContent = generateProfessionalHTML(quotation);
      return new NextResponse(htmlContent, {
        headers: {
          "Content-Type": "text/html",
          "Content-Disposition": `attachment; filename="quotation-${Date.now()}.html"`,
        },
      });
    }
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }
}

function generateProfessionalHTML(quotation: QuotationData): string {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Construction Material Quotation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: 'Arial', sans-serif;
            line-height: 1.6;
            color: #333;
            background: white;
        }
        
        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
        }
        
        .header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #2563eb;
            padding-bottom: 20px;
        }
        
        .header h1 {
            font-size: 28px;
            color: #1e40af;
            margin-bottom: 10px;
        }
        
        .header .company {
            font-size: 18px;
            color: #6b7280;
            margin-bottom: 5px;
        }
        
        .project-info {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .project-details h2 {
            color: #1e40af;
            font-size: 20px;
            margin-bottom: 5px;
        }
        
        .project-details p {
            color: #6b7280;
            margin-bottom: 3px;
        }
        
        .total-highlight {
            text-align: right;
        }
        
        .total-highlight .amount {
            font-size: 32px;
            font-weight: bold;
            color: #059669;
        }
        
        .total-highlight .label {
            color: #6b7280;
            font-size: 14px;
        }
        
        .section {
            margin-bottom: 30px;
        }
        
        .section h3 {
            color: #1e40af;
            font-size: 18px;
            margin-bottom: 15px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 5px;
        }
        
        .materials-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        
        .materials-table th {
            background: #1e40af;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
        }
        
        .materials-table td {
            padding: 10px 12px;
            border-bottom: 1px solid #e5e7eb;
            font-size: 14px;
        }
        
        .materials-table tr:nth-child(even) {
            background: #f8fafc;
        }
        
        .materials-table .text-right {
            text-align: right;
        }
        
        .materials-table .text-center {
            text-align: center;
        }
        
        .cost-summary {
            background: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #2563eb;
        }
        
        .cost-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
        }
        
        .cost-row:last-child {
            border-bottom: none;
            font-weight: bold;
            font-size: 18px;
            color: #059669;
            border-top: 2px solid #059669;
            padding-top: 12px;
            margin-top: 8px;
        }
        
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #6b7280;
            font-size: 12px;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
        }
        
        .terms {
            margin-top: 30px;
            font-size: 12px;
            color: #6b7280;
            line-height: 1.5;
        }
        
        .terms h4 {
            color: #374151;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CONSTRUCTION MATERIAL QUOTATION</h1>
            <div class="company">Professional Construction Services</div>
        </div>
        
        <div class="project-info">
            <div class="project-details">
                <h2>${quotation.projectName}</h2>
                <p><strong>Date:</strong> ${quotation.date}</p>
                <p><strong>Materials Count:</strong> ${
                  quotation.materials.length
                } items</p>
            </div>
            <div class="total-highlight">
                <div class="amount">$${quotation.totalCost.toLocaleString()}</div>
                <div class="label">Total Project Cost</div>
            </div>
        </div>
        
        <div class="section">
            <h3>Material Breakdown</h3>
            <table class="materials-table">
                <thead>
                    <tr>
                        <th style="width: 45%;">Material Description</th>
                        <th class="text-center" style="width: 12%;">Qty</th>
                        <th class="text-center" style="width: 12%;">Unit</th>
                        <th class="text-right" style="width: 15%;">Unit Price</th>
                        <th class="text-right" style="width: 16%;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${quotation.materials
                      .map(
                        (material) => `
                        <tr>
                            <td><strong>${material.name}</strong></td>
                            <td class="text-center">${material.quantity}</td>
                            <td class="text-center">${material.unit}</td>
                            <td class="text-right">$${material.unitPrice.toFixed(
                              2
                            )}</td>
                            <td class="text-right"><strong>$${material.totalPrice.toFixed(
                              2
                            )}</strong></td>
                        </tr>
                    `
                      )
                      .join("")}
                </tbody>
            </table>
        </div>
        
        <div class="section">
            <h3>Cost Summary</h3>
            <div class="cost-summary">
                <div class="cost-row">
                    <span>Materials Subtotal:</span>
                    <span>$${quotation.subtotal.toFixed(2)}</span>
                </div>
                <div class="cost-row">
                    <span>Labor Cost (60% of materials):</span>
                    <span>$${quotation.laborCost.toFixed(2)}</span>
                </div>
                <div class="cost-row">
                    <span>Equipment & Tools (15% of materials):</span>
                    <span>$${quotation.equipmentCost.toFixed(2)}</span>
                </div>
                <div class="cost-row">
                    <span>Overhead & Profit (20%):</span>
                    <span>$${quotation.overhead.toFixed(2)}</span>
                </div>
                <div class="cost-row">
                    <span>TOTAL PROJECT COST:</span>
                    <span>$${quotation.totalCost.toFixed(2)}</span>
                </div>
            </div>
        </div>
        
        <div class="terms">
            <h4>Terms & Conditions:</h4>
            <p>• This quotation is valid for 30 days from the date of issue.</p>
            <p>• Prices are subject to change based on material availability and market conditions.</p>
            <p>• Labor costs may vary based on project complexity and timeline.</p>
            <p>• Additional costs may apply for permits, inspections, and unforeseen circumstances.</p>
            <p>• Payment terms: 50% deposit, 50% upon completion.</p>
        </div>
        
        <div class="footer">
            <p>This quotation was generated using AI-powered construction material analysis.</p>
            <p>For questions or modifications, please contact our project team.</p>
            <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
    </div>
</body>
</html>
`;
}
