import { jsPDF } from 'jspdf';
import type { ChatReportData } from '../types';

/**
 * Gera e inicia o download do Relatório de Conversas e Indicação de Gatilhos em PDF.
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
  let cursorY = 18;

  const ensureSpace = (neededMm: number) => {
    if (cursorY + neededMm > pageHeight - 18) {
      doc.addPage();
      cursorY = 18;
    }
  };

  // Cabeçalho principal com faixa verde-calma
  doc.setFillColor(15, 118, 110); // #0f766e (calm-700)
  doc.roundedRect(marginX, cursorY, contentWidth, 28, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14.5);
  doc.text('Respira PWA — Relatório de Conversas e Indicação de Gatilhos', marginX + 6, cursorY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  const emittedAt = new Date(report.generatedAt).toLocaleString('pt-BR');
  doc.text(
    `Usuário(a): ${report.userName}   |   Amigo(a) de Conversa: ${report.friendName}`,
    marginX + 6,
    cursorY + 18
  );
  doc.text(`Emitido em: ${emittedAt}`, marginX + 6, cursorY + 24);

  cursorY += 35;

  // Quadro Resumo de Indicadores
  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.roundedRect(marginX, cursorY, contentWidth, 18, 2, 2, 'FD');

  doc.setTextColor(15, 118, 110);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(
    `Total de mensagens: ${report.totalMessages}   |   Desabafos por áudio: ${report.totalAudioMessages}   |   Mensagens em crise: ${report.totalCrisisMessages}   |   Botão de Pânico: ${report.totalPanicActivations}`,
    marginX + 5,
    cursorY + 11
  );

  cursorY += 25;

  // Seção 1: Histórico organizado por data + indicação de gatilhos de cada dia
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1. Histórico Cronológico de Conversas e Indicação Diária de Gatilhos', marginX, cursorY);
  cursorY += 7;

  if (report.days.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Nenhuma conversa registrada até o momento.', marginX, cursorY);
    cursorY += 10;
  }

  for (const day of report.days) {
    ensureSpace(26);

    // Cabeçalho da Data
    doc.setFillColor(226, 232, 240);
    doc.roundedRect(marginX, cursorY, contentWidth, 8, 1.5, 1.5, 'F');
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(
      `Data: ${day.date}${day.crisisCount > 0 ? `  •  (${day.crisisCount} relato(s) durante Modo Crise)` : ''}`,
      marginX + 4,
      cursorY + 5.5
    );
    cursorY += 12;

    // Mensagens do dia
    for (const msg of day.messages) {
      const senderLabel = msg.remetente === 'USER' ? 'Você' : report.friendName;
      const typeTag =
        msg.tipo === 'AUDIO'
          ? ` [Áudio${msg.audioDuration ? ` ${msg.audioDuration}s` : ''}]`
          : '';
      const crisisTag =
        msg.criseRelacionada && msg.remetente === 'USER' ? ' [Pós-Botão de Pânico]' : '';
      const prefix = `[${msg.horario}] ${senderLabel}${typeTag}${crisisTag}: `;
      const fullLine = `${prefix}${msg.conteudoTexto}`;

      doc.setFont('helvetica', msg.remetente === 'USER' ? 'bold' : 'normal');
      doc.setFontSize(9.2);
      doc.setTextColor(
        msg.remetente === 'USER' ? 15 : 51,
        msg.remetente === 'USER' ? 118 : 65,
        msg.remetente === 'USER' ? 110 : 85
      );

      const wrappedLines = doc.splitTextToSize(fullLine, contentWidth - 4) as string[];
      ensureSpace(wrappedLines.length * 4.5 + 3);

      doc.text(wrappedLines, marginX + 2, cursorY);
      cursorY += wrappedLines.length * 4.5 + 2;
    }

    // Box de Indicação / Diagnóstico Informativo do Dia
    const synthesisLines = doc.splitTextToSize(
      `Indicação / Síntese de Gatilhos (${day.date}): ${day.dailySynthesis}`,
      contentWidth - 8
    ) as string[];
    const boxHeight = synthesisLines.length * 4.5 + 6;
    ensureSpace(boxHeight + 6);

    doc.setFillColor(254, 243, 199);
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(marginX, cursorY, contentWidth, boxHeight, 2, 2, 'FD');

    doc.setTextColor(146, 64, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.2);
    doc.text(synthesisLines, marginX + 4, cursorY + 5);

    cursorY += boxHeight + 7;
  }

  // Seção 2: Síntese Geral de Padrões e Fatores Desencadeantes
  ensureSpace(45);
  cursorY += 3;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('2. Síntese Geral de Padrões e Fatores Desencadeantes', marginX, cursorY);
  cursorY += 7;

  if (report.topTriggers.length > 0) {
    for (const trigger of report.topTriggers) {
      const bulletLine = `• Gatilho identificado (${trigger.occurrences} dia(s)): ${trigger.label}`;
      const recLine = `  Recomendação de apoio: ${trigger.recommendation}`;

      const wrappedBullet = doc.splitTextToSize(bulletLine, contentWidth - 4) as string[];
      const wrappedRec = doc.splitTextToSize(recLine, contentWidth - 4) as string[];
      ensureSpace((wrappedBullet.length + wrappedRec.length) * 4.6 + 4);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 118, 110);
      doc.text(wrappedBullet, marginX + 2, cursorY);
      cursorY += wrappedBullet.length * 4.6;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(wrappedRec, marginX + 2, cursorY);
      cursorY += wrappedRec.length * 4.6 + 2.5;
    }
  }

  // Conclusão longitudinal
  const conclusionLines = doc.splitTextToSize(
    `Conclusão da Análise: ${report.overallConclusion}`,
    contentWidth - 8
  ) as string[];
  const conclusionHeight = conclusionLines.length * 4.6 + 8;
  ensureSpace(conclusionHeight + 12);

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(20, 184, 166);
  doc.roundedRect(marginX, cursorY, contentWidth, conclusionHeight, 2, 2, 'FD');
  doc.setTextColor(17, 94, 89);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.text(conclusionLines, marginX + 4, cursorY + 5.5);
  cursorY += conclusionHeight + 8;

  // Seção 3: Plano Prático de Acolhimento (Filmes, Livros, Músicas, Exercícios e Caminhadas)
  if (report.practicalSuggestions) {
    ensureSpace(48);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(
      '3. Sugestões Práticas de Regulação (Filmes, Livros, Músicas, Exercícios e Caminhadas)',
      marginX,
      cursorY
    );
    cursorY += 7;

    const categories: Array<{ title: string; items: string[] }> = [
      { title: 'Filmes Leves e Confortantes', items: report.practicalSuggestions.filmes },
      { title: 'Livros e Leituras Acolhedoras', items: report.practicalSuggestions.livros },
      { title: 'Músicas e Refúgio Sonoro', items: report.practicalSuggestions.musicas },
      { title: 'Exercícios de Respiração e Aterramento', items: report.practicalSuggestions.exercicios },
      { title: 'Caminhadas e Ar Livre', items: report.practicalSuggestions.caminhadas },
    ];

    for (const cat of categories) {
      const joined = `${cat.title}: ${cat.items.join(' | ')}`;
      const lines = doc.splitTextToSize(`• ${joined}`, contentWidth - 4) as string[];
      ensureSpace(lines.length * 4.4 + 3);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(51, 65, 85);
      doc.text(lines, marginX + 2, cursorY);
      cursorY += lines.length * 4.4 + 2;
    }
    cursorY += 4;
  }

  // Nota Ética / Disclaimer
  const disclaimerLines = doc.splitTextToSize(report.disclaimer, contentWidth) as string[];
  ensureSpace(disclaimerLines.length * 4 + 6);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.2);
  doc.setTextColor(100, 116, 139);
  doc.text(disclaimerLines, marginX, cursorY);

  const fileDate = report.generatedAt.slice(0, 10);
  doc.save(`relatorio-conversas-respira-${fileDate}.pdf`);
}
