import { jsPDF } from 'jspdf';
import type { ChatReportData } from '../types';

type RgbColor = [number, number, number];

/**
 * Gera e inicia o download do Relatório Profissional de Conversas e Gatilhos em PDF,
 * garantindo que todas as observações, sínteses diárias e notas fiquem perfeitamente
 * contidas dentro de seus respectivos retângulos, com numeração de páginas e período filtrado.
 */
export function generateAndDownloadChatReportPdf(report: ChatReportData): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 16;
  const contentWidth = pageWidth - marginX * 2;
  const bottomLimitY = pageHeight - 20;
  let cursorY = 16;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > bottomLimitY) {
      doc.addPage();
      cursorY = 18;
    }
  };

  /**
   * Desenha um retângulo de observação/síntese com cálculo exato de altura
   * (definindo fonte e tamanho ANTES de splitTextToSize), garantindo 100% que
   * o texto nunca vaze para fora da borda do retângulo.
   */
  const drawObservationBox = (options: {
    title: string;
    body: string;
    fillColor: RgbColor;
    borderColor: RgbColor;
    accentColor: RgbColor;
    titleColor: RgbColor;
    bodyColor: RgbColor;
    bodyFontStyle?: 'normal' | 'italic' | 'bold';
    bodyFontSize?: number;
  }) => {
    const {
      title,
      body,
      fillColor,
      borderColor,
      accentColor,
      titleColor,
      bodyColor,
      bodyFontStyle = 'normal',
      bodyFontSize = 9,
    } = options;

    const padLeft = 6.5;
    const padRight = 5;
    const padTop = 5;
    const padBottom = 5;
    const innerWidth = contentWidth - padLeft - padRight;

    // Define fonte ANTES do splitTextToSize para medição exata em mm
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const titleLines = doc.splitTextToSize(title, innerWidth) as string[];
    const titleLineH = 4.4;

    doc.setFont('helvetica', bodyFontStyle);
    doc.setFontSize(bodyFontSize);
    const bodyLines = doc.splitTextToSize(body, innerWidth) as string[];
    const bodyLineH = bodyFontSize * 0.3528 * 1.45; // ~4.6mm para 9pt

    const titleBlockH = titleLines.length * titleLineH;
    const gapBetweenTitleAndBody = 2.2;
    const bodyBlockH = bodyLines.length * bodyLineH;
    const boxHeight = padTop + titleBlockH + gapBetweenTitleAndBody + bodyBlockH + padBottom;

    ensureSpace(boxHeight + 4);

    // Fundo + borda externa
    doc.setFillColor(...fillColor);
    doc.setDrawColor(...borderColor);
    doc.setLineWidth(0.35);
    doc.roundedRect(marginX, cursorY, contentWidth, boxHeight, 2.2, 2.2, 'FD');

    // Faixa lateral de destaque (acabamento editorial profissional)
    doc.setFillColor(...accentColor);
    doc.roundedRect(marginX, cursorY, 2.2, boxHeight, 1, 1, 'F');

    // Renderiza título dentro da caixa
    let textY = cursorY + padTop + 3.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...titleColor);
    for (const line of titleLines) {
      doc.text(line, marginX + padLeft, textY);
      textY += titleLineH;
    }

    textY += gapBetweenTitleAndBody - 0.8;

    // Renderiza corpo linha a linha com espaçamento controlado dentro da caixa
    doc.setFont('helvetica', bodyFontStyle);
    doc.setFontSize(bodyFontSize);
    doc.setTextColor(...bodyColor);
    for (const line of bodyLines) {
      doc.text(line, marginX + padLeft, textY);
      textY += bodyLineH;
    }

    cursorY += boxHeight + 6;
  };

  // =========================================================================
  // CABEÇALHO EXECUTIVO
  // =========================================================================
  doc.setFillColor(15, 118, 110); // calm-700
  doc.roundedRect(marginX, cursorY, contentWidth, 34, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Respira PWA — Relatório de Acompanhamento Emocional', marginX + 6, cursorY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.2);
  const emittedAt = new Date(report.generatedAt).toLocaleString('pt-BR');
  const periodText = report.periodLabel || 'Todos os dias registrados';
  doc.text(
    `Paciente / Usuário(a): ${report.userName}   •   Amigo(a) de Escuta: ${report.friendName}`,
    marginX + 6,
    cursorY + 18
  );
  doc.text(`Período do Relatório: ${periodText}`, marginX + 6, cursorY + 24);
  doc.setFontSize(8.5);
  doc.setTextColor(204, 251, 241);
  doc.text(`Emitido em: ${emittedAt}`, marginX + 6, cursorY + 30);

  cursorY += 40;

  // =========================================================================
  // 4 CARDS DE INDICADORES (KPI)
  // =========================================================================
  const kpiGap = 3.5;
  const kpiWidth = (contentWidth - kpiGap * 3) / 4;
  const kpiHeight = 18;
  const kpis = [
    { label: 'Total de Mensagens', value: String(report.totalMessages) },
    { label: 'Desabafos em Áudio', value: String(report.totalAudioMessages) },
    { label: 'Relatos em Crise', value: String(report.totalCrisisMessages) },
    { label: 'Botão de Pânico', value: String(report.totalPanicActivations) },
  ];

  kpis.forEach((kpi, index) => {
    const x = marginX + index * (kpiWidth + kpiGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, cursorY, kpiWidth, kpiHeight, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(15, 118, 110);
    doc.text(kpi.value, x + kpiWidth / 2, cursorY + 8.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    doc.text(kpi.label, x + kpiWidth / 2, cursorY + 14.5, { align: 'center' });
  });

  cursorY += kpiHeight + 9;

  // =========================================================================
  // SEÇÃO 1: HISTÓRICO CRONOLÓGICO E OBSERVAÇÕES DIÁRIAS
  // =========================================================================
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('1. Histórico Cronológico de Conversas e Observações por Data', marginX, cursorY);
  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.5);
  doc.line(marginX, cursorY + 2, marginX + 72, cursorY + 2);
  cursorY += 8;

  if (report.days.length === 0) {
    drawObservationBox({
      title: 'Sem registros no período selecionado',
      body: `Nenhuma conversa foi encontrada para o filtro "${periodText}". Tente ampliar o intervalo de datas ou selecionar "Todos os dias".`,
      fillColor: [248, 250, 252],
      borderColor: [203, 213, 225],
      accentColor: [100, 116, 139],
      titleColor: [51, 65, 85],
      bodyColor: [71, 85, 105],
    });
  }

  for (const day of report.days) {
    ensureSpace(22);

    // Faixa de data do dia
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.25);
    doc.roundedRect(marginX, cursorY, contentWidth, 8.5, 1.8, 1.8, 'FD');

    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    const crisisLabel =
      day.crisisCount > 0 ? `   •   ${day.crisisCount} relato(s) durante Modo Crise` : '';
    doc.text(`Data: ${day.date}${crisisLabel}`, marginX + 4, cursorY + 5.7);
    cursorY += 12.5;

    // Mensagens do dia
    for (const msg of day.messages) {
      const isUser = msg.remetente === 'USER';
      const senderLabel = isUser ? 'Você' : report.friendName;
      const typeTag =
        msg.tipo === 'AUDIO'
          ? ` [Áudio${msg.audioDuration ? ` ${msg.audioDuration}s` : ''}]`
          : '';
      const crisisTag = msg.criseRelacionada && isUser ? ' [Modo Crise]' : '';
      const headerPrefix = `[${msg.horario}] ${senderLabel}${typeTag}${crisisTag}: `;
      const fullLine = `${headerPrefix}${msg.conteudoTexto}`;

      doc.setFont('helvetica', isUser ? 'bold' : 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(isUser ? 15 : 51, isUser ? 118 : 65, isUser ? 110 : 85);

      const wrappedLines = doc.splitTextToSize(fullLine, contentWidth - 6) as string[];
      const lineStep = 4.3;
      ensureSpace(wrappedLines.length * lineStep + 2.5);

      for (const line of wrappedLines) {
        doc.text(line, marginX + 3, cursorY);
        cursorY += lineStep;
      }
      cursorY += 1.8;
    }

    cursorY += 1.5;

    // Retângulo de Observação / Indicação Diária de Gatilhos (100% ajustado)
    drawObservationBox({
      title: `Observação e Indicação de Gatilhos — ${day.date}`,
      body: day.dailySynthesis,
      fillColor: [255, 251, 235],
      borderColor: [252, 211, 77],
      accentColor: [217, 119, 6],
      titleColor: [146, 64, 14],
      bodyColor: [120, 53, 15],
      bodyFontStyle: 'normal',
      bodyFontSize: 8.8,
    });
  }

  // =========================================================================
  // SEÇÃO 2: SÍNTESE GERAL DE PADRÕES E GATILHOS
  // =========================================================================
  ensureSpace(34);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.text('2. Síntese Geral de Padrões e Fatores Desencadeantes', marginX, cursorY);
  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.5);
  doc.line(marginX, cursorY + 2, marginX + 72, cursorY + 2);
  cursorY += 8;

  if (report.topTriggers.length > 0) {
    for (const trigger of report.topTriggers) {
      drawObservationBox({
        title: `Gatilho identificado (${trigger.occurrences} dia(s)): ${trigger.label}`,
        body: `Recomendação de apoio: ${trigger.recommendation}`,
        fillColor: [248, 250, 252],
        borderColor: [203, 213, 225],
        accentColor: [15, 118, 110],
        titleColor: [15, 118, 110],
        bodyColor: [51, 65, 85],
        bodyFontStyle: 'normal',
        bodyFontSize: 8.8,
      });
    }
  }

  // Caixa de Conclusão Longitudinal
  drawObservationBox({
    title: 'Conclusão e Observação Longitudinal',
    body: report.overallConclusion,
    fillColor: [240, 253, 250],
    borderColor: [94, 234, 212],
    accentColor: [13, 148, 136],
    titleColor: [17, 94, 89],
    bodyColor: [19, 78, 74],
    bodyFontStyle: 'normal',
    bodyFontSize: 9,
  });

  // =========================================================================
  // SEÇÃO 3: SUGESTÕES PRÁTICAS DE REGULAÇÃO
  // =========================================================================
  if (report.practicalSuggestions) {
    ensureSpace(34);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.text('3. Plano Prático de Acolhimento e Descompressão', marginX, cursorY);
    doc.setDrawColor(20, 184, 166);
    doc.setLineWidth(0.5);
    doc.line(marginX, cursorY + 2, marginX + 72, cursorY + 2);
    cursorY += 8;

    const planSummary = [
      `Filmes leves: ${report.practicalSuggestions.filmes.join(' | ')}`,
      `Livros acolhedores: ${report.practicalSuggestions.livros.join(' | ')}`,
      `Músicas e sons: ${report.practicalSuggestions.musicas.join(' | ')}`,
      `Exercícios: ${report.practicalSuggestions.exercicios.join(' | ')}`,
      `Caminhadas: ${report.practicalSuggestions.caminhadas.join(' | ')}`,
    ].join('\n');

    drawObservationBox({
      title: 'Sugestões Personalizadas (Filmes, Livros, Músicas, Exercícios e Caminhadas)',
      body: planSummary,
      fillColor: [248, 250, 252],
      borderColor: [203, 213, 225],
      accentColor: [71, 85, 105],
      titleColor: [30, 41, 59],
      bodyColor: [51, 65, 85],
      bodyFontStyle: 'normal',
      bodyFontSize: 8.5,
    });
  }

  // =========================================================================
  // CAIXA DE OBSERVAÇÃO ÉTICA / AVISO IMPORTANTE (DENTRO DO RETÂNGULO)
  // =========================================================================
  drawObservationBox({
    title: 'Observação Importante / Aviso Ético',
    body: report.disclaimer,
    fillColor: [241, 245, 249],
    borderColor: [148, 163, 184],
    accentColor: [100, 116, 139],
    titleColor: [51, 65, 85],
    bodyColor: [71, 85, 105],
    bodyFontStyle: 'italic',
    bodyFontSize: 8.4,
  });

  // =========================================================================
  // RODAPÉ PROFISSIONAL COM NUMERAÇÃO EM TODAS AS PÁGINAS
  // =========================================================================
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(marginX, pageHeight - 13, pageWidth - marginX, pageHeight - 13);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Respira PWA — Documento confidencial de autoconhecimento e apoio emocional (${periodText})`,
      marginX,
      pageHeight - 8
    );
    doc.text(`Página ${page} de ${totalPages}`, pageWidth - marginX, pageHeight - 8, {
      align: 'right',
    });
  }

  const fileDate = report.generatedAt.slice(0, 10);
  doc.save(`relatorio-respira-${fileDate}.pdf`);
}
