import { pdf } from '@react-pdf/renderer';
import { PdfDocument } from './PdfDocument';

/**
 * Service to generate PDFs natively using @react-pdf/renderer without rendering a Viewer in the DOM.
 */
export const PdfEngine = {
    /**
     * Generates a PDF Blob url for a given document payload and type.
     */
    generateDocumentUrl: async (data: any, type: 'FACTURA' | 'BOLETA' | 'GUIA' | 'GUIA_CONSOLIDADA' | 'NOTA DE CREDITO' | 'NOTA_CREDITO' | 'BATCH', companyInfo: any): Promise<string> => {
        try {
            const docElement = <PdfDocument data={data} type={type} companyInfo={companyInfo} />;
            const pdfBlob = await pdf(docElement).toBlob();
            return URL.createObjectURL(pdfBlob);
        } catch (error) {
            console.error("Error generating PDF:", error);
            throw error;
        }
    },
    
    /**
     * Generates and immediately opens a PDF in a new tab.
     */
    openDocument: async (data: any, type: 'FACTURA' | 'BOLETA' | 'GUIA' | 'GUIA_CONSOLIDADA' | 'NOTA DE CREDITO' | 'NOTA_CREDITO' | 'BATCH', companyInfo: any) => {
        const url = await PdfEngine.generateDocumentUrl(data, type, companyInfo);
        window.open(url, '_blank');
        // Optional: Revoke URL after a delay if needed to free memory, but usually keeping it for the session is fine.
    }
};
