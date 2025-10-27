// exportExcelService.js - versão atualizada
import * as XLSX from 'xlsx';

export async function exportToExcel(exportData) {
    const workbook = XLSX.utils.book_new();
    
    // Aba de Resumo
    const summarySheet = XLSX.utils.json_to_sheet([exportData.summary]);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');
    
    // Aba de Duplicatas Exatas
    if (exportData.duplicatas.length > 0) {
        const duplicatesSheet = XLSX.utils.json_to_sheet(exportData.duplicatas);
        XLSX.utils.book_append_sheet(workbook, duplicatesSheet, 'Duplicatas Exatas');
    }
    
    // Aba de Possíveis Duplicatas
    if (exportData.possiveisDuplicatas.length > 0) {
        const possibleSheet = XLSX.utils.json_to_sheet(exportData.possiveisDuplicatas);
        XLSX.utils.book_append_sheet(workbook, possibleSheet, 'Possíveis Duplicatas');
    }
    
    // Aba com Todas as Entradas
    const allEntriesSheet = XLSX.utils.json_to_sheet(exportData.todasEntradas);
    XLSX.utils.book_append_sheet(workbook, allEntriesSheet, 'Todas as Entradas');
    
    // Gerar buffer
    const excelBuffer = XLSX.write(workbook, { 
        bookType: 'xlsx', 
        type: 'buffer',
        compression: true 
    });
    
    return excelBuffer;
}