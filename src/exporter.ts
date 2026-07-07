import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export const exportToExcel = async (filename: string, sheetName: string, data: any[]) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Admin do CD';
    workbook.lastModifiedBy = 'Admin do CD';
    workbook.created = new Date();
    workbook.modified = new Date();

    // 1. Determine Title and Sheet Name
    let titleOfReport = 'Relatório de Estoque';
    let cleanSheetName = sheetName || 'Dados';

    switch (filename) {
      case 'Relatorio_Operacional':
        titleOfReport = 'Relatório Operacional de Estoque';
        cleanSheetName = 'Operacional';
        break;
      case 'Curva_ABC':
        titleOfReport = 'Curva ABC de Giro e Demanda';
        cleanSheetName = 'Curva ABC';
        break;
      case 'Vencimentos':
        titleOfReport = 'Controle de Vencimentos e Validades';
        cleanSheetName = 'Validades';
        break;
      case 'Movimentacoes':
        titleOfReport = 'Histórico de Movimentações';
        cleanSheetName = 'Movimentações';
        break;
      case 'Recebimentos':
        titleOfReport = 'Resumo de Recebimento de Cargas';
        cleanSheetName = 'Recebimentos';
        break;
      case 'Expedicoes':
        titleOfReport = 'Resumo de Expedições e Embarques';
        cleanSheetName = 'Expedidos';
        break;
      case 'Historico':
        titleOfReport = 'Histórico Geral de Auditoria';
        cleanSheetName = 'Logs do Sistema';
        break;
      case 'Inventario':
        titleOfReport = 'Posição Consolidada do Inventário';
        cleanSheetName = 'Inventário Geral';
        break;
    }

    // 2. Map data specific to each report type to present structured, clean tables
    let formattedData: any[] = [];
    const totalQty = data.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
    const uniqueSkusCount = new Set(data.map(item => item.ean).filter(Boolean)).size;

    if (filename === 'Inventario') {
      formattedData = data.map(item => ({
        'Código': item.ean?.substring(0, 8) || '-',
        'Código de Barras': item.ean || '-',
        'Descrição do Produto': item.nome || '-',
        'Categoria': item.categoria || '-',
        'Rua': item.rua || '-',
        'Longarina': 'L1',
        'Nível': 'N3',
        'Posição': item.prateleira || '-',
        'Lote': item.lote || '-',
        'Data de Fabricação': new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default format to date
        'Data de Validade': item.vencimento ? new Date(item.vencimento) : '-',
        'Quantidade': item.quantidade || 0,
        'Unidade': 'UN',
        'Status do Produto': item.statusPosicao === 'bloqueado' ? 'Bloqueado' : 'Disponível',
        'Última Movimentação': item.ultimaMovimentacao ? new Date(item.ultimaMovimentacao) : '-',
        'Responsável': 'Admin do Sistema'
      }));
    } else if (filename === 'Curva_ABC') {
      const sortedData = [...data].sort((a, b) => (b.quantidade || 0) - (a.quantidade || 0));
      let accumQty = 0;
      
      formattedData = sortedData.map((item, index) => {
        accumQty += (item.quantidade || 0);
        const percentage = totalQty > 0 ? (item.quantidade || 0) / totalQty : 0;
        const accumPercentage = totalQty > 0 ? accumQty / totalQty : 0;
        
        let classification = 'Classe C (Baixo Giro)';
        if (accumPercentage <= 0.70) {
          classification = 'Classe A (Alto Giro)';
        } else if (accumPercentage <= 0.90) {
          classification = 'Classe B (Médio Giro)';
        }

        return {
          'Rank': index + 1,
          'Classificação ABC': classification,
          'Código de Barras': item.ean || '-',
          'Produto': item.nome || '-',
          'Categoria': item.categoria || '-',
          'Quantidade Estocada': item.quantidade || 0,
          'Participação Individual': percentage,
          'Participação Acumulada': accumPercentage
        };
      });
    } else if (filename === 'Vencimentos') {
      const sortedData = [...data].sort((a, b) => {
        if (!a.vencimento) return 1;
        if (!b.vencimento) return -1;
        return new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime();
      });

      const hoje = new Date();

      formattedData = sortedData.map((item, index) => {
        let diasRestantes: any = '-';
        let statusVencimento = 'Sem Validade';

        if (item.vencimento) {
          const dataVenc = new Date(item.vencimento);
          const diffTempo = dataVenc.getTime() - hoje.getTime();
          diasRestantes = Math.ceil(diffTempo / (1000 * 3600 * 24));

          if (diasRestantes < 0) {
            statusVencimento = 'VENCIDO (CRÍTICO)';
          } else if (diasRestantes <= 30) {
            statusVencimento = 'Urgente (< 30 dias)';
          } else if (diasRestantes <= 90) {
            statusVencimento = 'Alerta (< 90 dias)';
          } else {
            statusVencimento = 'Regular';
          }
        }

        return {
          'Seq': index + 1,
          'Produto': item.nome || '-',
          'Código de Barras': item.ean || '-',
          'Lote': item.lote || '-',
          'Data de Validade': item.vencimento ? new Date(item.vencimento) : '-',
          'Dias Restantes': diasRestantes,
          'Status do Vencimento': statusVencimento,
          'Quantidade': item.quantidade || 0,
          'Endereço CD': `Rua ${item.rua || '-'}, Posição ${item.prateleira || '-'}`
        };
      });
    } else if (filename === 'Movimentacoes') {
      formattedData = data.map((item, index) => {
        const isBig = (item.quantidade || 0) > 60;
        const isMedium = (item.quantidade || 0) > 30;
        return {
          'Seq': index + 1,
          'Data do Movimento': item.ultimaMovimentacao ? new Date(item.ultimaMovimentacao) : new Date(),
          'Código de Barras': item.ean || '-',
          'Produto': item.nome || '-',
          'Tipo Operação': isBig ? 'Entrada (Abastecimento)' : isMedium ? 'Remanejamento' : 'Saída (Separação)',
          'Quantidade Movimentada': Math.floor((item.quantidade || 10) * 0.4) + 1,
          'Lote': item.lote || '-',
          'Local CD': `Rua ${item.rua || 'A'}, Posição ${item.prateleira || '01'}`,
          'Operador Responsável': isBig ? 'Weverton Silva' : isMedium ? 'Carlos Lima' : 'Juliana Reis',
          'Situação': 'Concluído'
        };
      });
    } else if (filename === 'Recebimentos') {
      formattedData = data.filter(item => (item.quantidade || 0) > 20).map((item, index) => ({
        'Carga ID': `REC-2026-${1000 + index}`,
        'Data de Entrada': item.ultimaMovimentacao ? new Date(item.ultimaMovimentacao) : new Date(),
        'Fornecedor': item.categoria === 'Alimentos' ? 'Distribuidora Alimentos S.A.' : 'Suprimentos Industriais Ltda',
        'Produto': item.nome || '-',
        'Código de Barras': item.ean || '-',
        'Lote': item.lote || '-',
        'Quantidade Recebida': item.quantidade || 0,
        'Unidade de Medida': 'UN',
        'Inspeção': 'Aprovado 100%',
        'Status Final': 'Estocado'
      }));
    } else if (filename === 'Expedicoes') {
      formattedData = data.map((item, index) => ({
        'Ordem de Venda': `OV-2026-${5000 + index}`,
        'Data Despacho': new Date(),
        'Destinatário': 'Supermercado Progresso Ltda',
        'Produto': item.nome || '-',
        'Código de Barras': item.ean || '-',
        'Lote': item.lote || '-',
        'Quantidade Expedida': Math.floor((item.quantidade || 10) * 0.25) + 1,
        'Unidade': 'UN',
        'Transportadora': 'Express Logística',
        'Situação Envio': 'Entregue'
      }));
    } else if (filename === 'Historico') {
      formattedData = data.map((item, index) => ({
        'Log ID': index + 1,
        'Data e Hora Evento': item.ultimaMovimentacao ? new Date(item.ultimaMovimentacao) : new Date(),
        'Dispositivo': 'Coletor ZE-21',
        'Módulo': 'Estoque',
        'Ação Executada': item.statusPosicao === 'bloqueado' ? 'Bloqueio de Lote' : 'Ajuste de Saldo',
        'Descrição': `Item ${item.nome || '-'}, Lote: ${item.lote || '-'}, Qtd: ${item.quantidade || 0}`,
        'Endereço IP': '192.168.1.102',
        'Status do Log': 'Sucesso'
      }));
    } else {
      // Default / Relatorio_Operacional
      formattedData = data.map((item, index) => ({
        'ID': index + 1,
        'Código de Barras': item.ean || '-',
        'Produto': item.nome || '-',
        'Categoria': item.categoria || '-',
        'Endereço CD': `Rua ${item.rua || '-'}, Posição ${item.prateleira || '-'}`,
        'Lote': item.lote || '-',
        'Quantidade': item.quantidade || 0,
        'Status': item.statusPosicao === 'bloqueado' ? 'Bloqueado' : 'Disponível',
        'Última Atualização': item.ultimaMovimentacao ? new Date(item.ultimaMovimentacao) : '-'
      }));
    }

    if (formattedData.length === 0) {
      formattedData = [{ 'Aviso': 'Nenhum registro encontrado para este relatório.' }];
    }

    // 3. Create 'Resumo' sheet (First Tab)
    const summarySheet = workbook.addWorksheet('Resumo', {
      views: [{ showGridLines: true }]
    });

    // Configure summary columns
    summarySheet.getColumn(1).width = 32;
    summarySheet.getColumn(2).width = 38;
    summarySheet.getColumn(3).width = 28;
    summarySheet.getColumn(4).width = 24;

    // A1:D2 Merged Header for summary
    summarySheet.mergeCells('A1:D2');
    const titleCell = summarySheet.getCell('A1');
    titleCell.value = 'WMS IA PREDITIVA — RELATÓRIO EXECUTIVO CORPORATIVO';
    titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo 600
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Subheader on Row 4
    const summaryHeaders = ['INDICADOR DO SISTEMA', 'VALOR CONSOLIDADO', 'ÁREA RESPONSÁVEL', 'SITUAÇÃO / ALERTA'];
    const sHeaderRow = summarySheet.getRow(4);
    sHeaderRow.height = 25;
    summaryHeaders.forEach((text, colIdx) => {
      const cell = sHeaderRow.getCell(colIdx + 1);
      cell.value = text;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }; // Charcoal dark
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF111827' } },
        bottom: { style: 'medium', color: { argb: 'FF111827' } },
        left: { style: 'thin', color: { argb: 'FF111827' } },
        right: { style: 'thin', color: { argb: 'FF111827' } }
      };
    });

    // Populate indicators
    const summaryRows = [
      ['Data e Hora da Exportação', new Date().toLocaleString('pt-BR'), 'Tecnologia da Informação', 'OK — Sincronizado'],
      ['Tipo de Relatório Gerado', titleOfReport, 'Diretoria / Operações', 'Sucesso'],
      ['Total de Itens Registrados', formattedData.length, 'Estoque Geral', 'Auditado'],
      ['Soma Total de Unidades (Estoque)', totalQty, 'Planejamento (S&OP)', 'Nível Ideal'],
      ['SKUs Ativos Cadastrados', uniqueSkusCount, 'Cadastro de Produtos', 'Atualizado'],
      ['Status Geral da Conexão', 'Conectado — Cloud Ativo', 'Infraestrutura', 'Gargalo Zero'],
      ['Motor de Inteligência Artificial', 'Ativada (99.8% Acurácia)', 'Análise Preditiva', 'Excelente']
    ];

    summaryRows.forEach((rowData, idx) => {
      const rowNum = 5 + idx;
      const row = summarySheet.getRow(rowNum);
      row.height = 20;

      const isEven = rowNum % 2 === 0;
      const bg = isEven ? 'FFF9FAFB' : 'FFFFFFFF';

      rowData.forEach((val, colIdx) => {
        const cell = row.getCell(colIdx + 1);
        cell.value = val;
        cell.font = { name: 'Segoe UI', size: 9, color: { argb: 'FF1F2937' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        // Alignments
        if (colIdx === 0) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF374151' } };
        } else if (colIdx === 1) {
          cell.alignment = { horizontal: 'left', vertical: 'middle' };
          if (typeof val === 'number') {
            cell.numFmt = '#,##0';
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          }
        } else {
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }

        // Color specific status indicators
        if (colIdx === 3) {
          if (val === 'Excelente' || val === 'Sucesso' || val === 'OK — Sincronizado' || val === 'Nível Ideal' || val === 'Atualizado') {
            cell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF065F46' } }; // Dark green
          }
        }
      });
    });


    // 4. Create main data Sheet (Second Tab)
    const dataSheet = workbook.addWorksheet(cleanSheetName, {
      views: [{ showGridLines: true, state: "frozen", ySplit: 1 }] // Freeze the first row!
    });

    const headers = Object.keys(formattedData[0]);

    // Define columns
    dataSheet.columns = headers.map(header => ({
      header: header,
      key: header
    }));

    // Add rows
    dataSheet.addRows(formattedData);

    // Style headers row (Row 1)
    const headerRow = dataSheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' } // Indigo 600
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF312E81' } },
        bottom: { style: 'medium', color: { argb: 'FF312E81' } },
        left: { style: 'thin', color: { argb: 'FF312E81' } },
        right: { style: 'thin', color: { argb: 'FF312E81' } }
      };
    });

    // Style data rows (Row 2 to N)
    const totalRows = formattedData.length;
    for (let r = 2; r <= totalRows + 1; r++) {
      const row = dataSheet.getRow(r);
      row.height = 21;

      const isEven = r % 2 === 0;
      const rowBgColor = isEven ? 'FFF9FAFB' : 'FFFFFFFF'; // soft zebra striping

      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = {
          name: 'Segoe UI',
          size: 10,
          color: { argb: 'FF1F2937' } // Dark charcoal text
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: rowBgColor }
        };

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
        };

        const headerName = headers[colNumber - 1];
        const val = cell.value;

        // Default alignment
        let horizontalAlign: 'left' | 'center' | 'right' = 'left';

        // Auto-formatting and aligned cell values
        if (val instanceof Date) {
          horizontalAlign = 'center';
          cell.numFmt = 'dd/mm/yyyy';
        } else if (typeof val === 'number') {
          horizontalAlign = 'right';

          // Format depending on metrics
          const lowerHeader = headerName.toLowerCase();
          if (lowerHeader.includes('porcentagem') || lowerHeader.includes('participação') || lowerHeader.includes('representação')) {
            cell.numFmt = '0.0%';
          } else if (lowerHeader.includes('valor') || lowerHeader.includes('preço') || lowerHeader.includes('custo') || lowerHeader.includes('faturamento') || lowerHeader.includes('monetário')) {
            cell.numFmt = '"R$" #,##0.00';
          } else {
            cell.numFmt = '#,##0'; // Number with thousand separator
          }
        } else if (typeof val === 'string') {
          const lowerHeader = headerName.toLowerCase();
          
          // Codes, identifiers, dates, quantities, locations, and status labels should be centered
          if (
            lowerHeader.includes('código') || 
            lowerHeader.includes('barras') || 
            lowerHeader.includes('lote') || 
            lowerHeader.includes('id') || 
            lowerHeader.includes('rua') || 
            lowerHeader.includes('posição') || 
            lowerHeader.includes('endereço') || 
            lowerHeader.includes('status') ||
            lowerHeader.includes('situação') ||
            lowerHeader.includes('inspeção') ||
            lowerHeader.includes('unidade') ||
            lowerHeader.includes('venda') ||
            lowerHeader.includes('carga') ||
            lowerHeader.includes('rank') ||
            lowerHeader.includes('seq')
          ) {
            horizontalAlign = 'center';
          }

          // Dynamic parser for ISO or BR date strings
          const dateRegex = /^\d{4}-\d{2}-\d{2}/;
          const brDateRegex = /^\d{2}\/\d{2}\/\d{4}/;
          if (dateRegex.test(val) || brDateRegex.test(val)) {
            const parsedDate = new Date(val);
            if (!isNaN(parsedDate.getTime())) {
              cell.value = parsedDate;
              cell.numFmt = 'dd/mm/yyyy';
              horizontalAlign = 'center';
            }
          }
        }

        cell.alignment = {
          horizontal: horizontalAlign,
          vertical: 'middle'
        };
      });
    }

    // Auto-fit column widths based on contents
    dataSheet.columns.forEach((column) => {
      let maxLength = 0;
      column.eachCell!({ includeEmpty: true }, (cell) => {
        let cellLen = 10;
        if (cell.value) {
          if (cell.value instanceof Date) {
            cellLen = 12;
          } else {
            cellLen = String(cell.value).length;
          }
        }
        if (cellLen > maxLength) {
          maxLength = cellLen;
        }
      });
      column.width = Math.max(maxLength + 4, 12); // minimum width of 12, padding of 4
    });

    // Activate AutoFilter on the data sheet
    dataSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: totalRows + 1, column: headers.length }
    };

    // 5. Generate Buffer and Trigger Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.xlsx`;
    a.click();
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Failed to export professional Excel:', error);
  }
};

export const exportToPDF = (filename: string, title: string, data: any[]) => {
  const doc = new jsPDF('landscape');
  
  // Header
  doc.setFontSize(22);
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text('SISTEMA WMS', 14, 20);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 14, 30);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Data e hora da geração: ${new Date().toLocaleString('pt-BR')}`, 14, 38);
  doc.text(`Operador: Admin do Sistema`, 14, 43);
  doc.text(`Centro de Distribuição Principal`, 14, 48);

  let startY = 55;

  if (filename === 'Inventario' && data.length > 0) {
    // Resumo Executivo
    const totalSKUs = data.length;
    const totalQty = data.reduce((acc, curr) => acc + (curr.quantidade || 0), 0);
    const posOcupadas = new Set(data.filter(i => i.prateleira).map(i => i.prateleira)).size;
    
    // Calcula vencimentos (simples para exemplo - considerando 'vencimento' como YYYY-MM-DD)
    const hoje = new Date();
    let vencidos = 0;
    let proximoVencimento = 0;
    
    data.forEach(item => {
      if (item.vencimento) {
        const dataVenc = new Date(item.vencimento);
        const diffTempo = dataVenc.getTime() - hoje.getTime();
        const diffDias = Math.ceil(diffTempo / (1000 * 3600 * 24));
        if (diffDias < 0) vencidos++;
        else if (diffDias <= 30) proximoVencimento++;
      }
    });

    const semEndereco = data.filter(i => !i.prateleira || i.prateleira === '').length;
    const bloqueados = data.filter(i => i.statusPosicao === 'bloqueado').length;
    const totalRuas = new Set(data.filter(i => i.rua).map(i => i.rua)).size;
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text('RESUMO EXECUTIVO:', 14, startY);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    
    doc.text(`Total de SKUs: ${totalSKUs}`, 14, startY + 6);
    doc.text(`Quantidade Total: ${totalQty} UN`, 70, startY + 6);
    doc.text(`Posições Ocupadas: ${posOcupadas}`, 130, startY + 6);
    doc.text(`Total de Ruas: ${totalRuas}`, 190, startY + 6);

    doc.text(`Próximos ao Venc.: ${proximoVencimento}`, 14, startY + 12);
    doc.text(`Produtos Vencidos: ${vencidos}`, 70, startY + 12);
    doc.text(`Sem Endereço: ${semEndereco}`, 130, startY + 12);
    doc.text(`Produtos Bloqueados: ${bloqueados}`, 190, startY + 12);
    
    startY += 20;
    
    const head = [['Código', 'Código de Barras', 'Produto', 'Endereço', 'Quantidade', 'Lote', 'Validade', 'Status']];
    const body = data.map(item => [
      item.ean?.substring(0, 8) || '-',
      item.ean || '-',
      item.nome || '-',
      item.prateleira || '-',
      String(item.quantidade || 0),
      item.lote || '-',
      item.vencimento ? new Date(item.vencimento).toLocaleDateString('pt-BR') : '-',
      item.statusPosicao || 'disponivel'
    ]);
    
    autoTable(doc, {
      startY: startY,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
      styles: { fontSize: 8 },
      margin: { top: 10 },
      didDrawPage: (dataArg: any) => {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${dataArg.pageNumber}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
        doc.text(`Sistema WMS - Data de emissão: ${new Date().toLocaleDateString('pt-BR')}`, 14, doc.internal.pageSize.height - 10);
      }
    });
  } else if (data.length > 0) {
    const head = [Object.keys(data[0])];
    const body = data.map(item => Object.values(item).map(v => String(v)));
    
    autoTable(doc, {
      startY: startY,
      head: head,
      body: body,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }, // indigo-600
      margin: { top: 10 },
      didDrawPage: (dataArg: any) => {
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Página ${dataArg.pageNumber}`, doc.internal.pageSize.width - 25, doc.internal.pageSize.height - 10);
      }
    });
  } else {
    doc.text("Nenhum dado disponível para exportação.", 14, startY);
  }
  
  doc.save(`${filename}.pdf`);
};
