document.addEventListener('DOMContentLoaded', function() {
  const rawAnalysis = window.__JINJA_AI_ANALYSIS__;
  if (!rawAnalysis) return;

  let analysis;
  try {
    analysis = typeof rawAnalysis === 'string' ? JSON.parse(rawAnalysis) : rawAnalysis;
  } catch (e) {
    console.error('Failed to parse AI analysis:', e);
    return;
  }

  if (analysis.error) {
    console.error('AI Analysis error:', analysis.error);
    return;
  }

  // Apply KPI Descriptions
  if (analysis.kpi_descriptions) {
    const kpiDescIds = ['kpiTotal', 'kpiAvg', 'kpiPrediction', 'kpiAnomalies'];
    const descKeys = ['total', 'average', 'prediction', 'anomalies'];
    
    kpiDescIds.forEach((id, idx) => {
      const descElem = document.getElementById(id + 'Desc');
      if (descElem && analysis.kpi_descriptions[descKeys[idx]]) {
        descElem.textContent = analysis.kpi_descriptions[descKeys[idx]];
      }
    });
  }

  // Apply KPI Labels
  if (analysis.kpi_labels) {
    const labelIds = ['kpiTotalLabel', 'kpiAvgLabel', 'kpiPredictionLabel', 'kpiAnomaliesLabel'];
    const labelKeys = ['total', 'average', 'prediction', 'anomalies'];
    
    labelIds.forEach((id, idx) => {
      const elem = document.getElementById(id);
      if (elem && analysis.kpi_labels[labelKeys[idx]]) {
        elem.textContent = analysis.kpi_labels[labelKeys[idx]];
      }
    });
  }

  // Apply Chart Descriptions
  if (analysis.chart_descriptions) {
    const charts = [
      { title: 'trendTitle', note: 'trendNote', key: 'trend' },
      { title: 'categoryTitle', note: 'categoryNote', key: 'category' },
      { title: 'monthlyTitle', note: 'monthlyNote', key: 'monthly' },
      { title: 'scatterTitle', note: 'scatterNote', key: 'scatter' },
      { title: 'cumulativeTitle', note: 'cumulativeNote', key: 'cumulative' },
      { title: 'rollingTitle', note: 'rollingNote', key: 'rolling' },
      { title: 'velocityTitle', note: 'velocityNote', key: 'velocity' },
      { title: 'volatilityTitle', note: 'volatilityNote', key: 'volatility' },
      { title: 'expenseTitle', note: 'expenseNote', key: 'fixed_variable' }
    ];

    charts.forEach(chart => {
      const noteElem = document.getElementById(chart.note);
      if (noteElem && analysis.chart_descriptions[chart.key]) {
        noteElem.textContent = analysis.chart_descriptions[chart.key];
      }
    });
  }

  // Apply Executive Summary
  if (analysis.executive_summary) {
    const summaryElem = document.getElementById('summaryText');
    const summarySection = document.getElementById('executiveSummary');
    if (summaryElem && summarySection) {
      summaryElem.textContent = analysis.executive_summary;
      summarySection.style.display = 'block';
    }
  }

  // Apply Recommendations
  if (analysis.spending_insights && analysis.spending_insights.length > 0) {
    const recommendationsPanel = document.getElementById('aiRecommendationsPanel');
    const recommendationsContent = document.getElementById('recommendationsContent');
    
    if (recommendationsPanel && recommendationsContent) {
      let html = '';
      
      analysis.spending_insights.forEach(insight => {
        html += `
          <div class="rec-insight-card">
            <div class="rec-insight-title">📊 ${insight.title}</div>
            <div class="rec-insight-text">${insight.finding}</div>
            <div class="rec-insight-implication">💡 ${insight.implication}</div>
          </div>
        `;
      });

      if (analysis.recommendations && analysis.recommendations.length > 0) {
        html += '<div class="rec-section-header">Recommended Actions</div>';
        analysis.recommendations.forEach(rec => {
          const priorityClass = `rec-action-priority-${rec.priority.toLowerCase()}`;
          html += `
            <div class="rec-action-item">
              <span class="rec-action-priority ${priorityClass}">${rec.priority} Priority</span>
              <div class="rec-action-category">🎯 ${rec.action}</div>
              <div class="rec-action-description">💰 Impact: ${rec.impact}</div>
            </div>
          `;
        });
      }

      recommendationsContent.innerHTML = html;
      recommendationsPanel.style.display = 'block';
    }
  }
});
