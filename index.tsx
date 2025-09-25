/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import { GoogleGenAI, Type } from "@google/genai";

// Main application state
let file1: File | null = null;
let file2: File | null = null;

// --- UI Components ---
const AppShell = `
<main class="container mx-auto p-4 md:p-8 max-w-6xl space-y-8">
    <header class="text-center space-y-2">
        <h1 class="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-600">
            Module Content Quality Analysis
        </h1>
        <p class="text-gray-400">
            Compare feedback from two teaching periods to track improvements and identify trends in your module's content.
        </p>
    </header>

    <section class="grid md:grid-cols-2 gap-6" aria-labelledby="upload-heading">
        <h2 id="upload-heading" class="sr-only">Upload Feedback Files</h2>
        <div id="file1-dropzone"></div>
        <div id="file2-dropzone"></div>
    </section>

    <div class="text-center">
        <button id="analyze-button"
            class="bg-indigo-600 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 disabled:transform-none"
            disabled>
            Analyze & Compare
        </button>
    </div>

    <div id="loading-spinner" class="hidden justify-center items-center py-8">
        <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-400"></div>
        <p class="ml-4 text-gray-300">AI is analyzing... this may take a moment.</p>
    </div>

    <div id="error-message" class="hidden text-center text-red-400 p-4 bg-red-900/50 rounded-lg"></div>

    <div id="results-container" class="space-y-8"></div>
</main>
`;

const FileInput = (id: string, label: string): string => `
<div class="bg-gray-800 p-6 rounded-xl border-2 border-dashed border-gray-600 hover:border-indigo-500 transition-colors duration-300 text-center">
    <label for="${id}" class="cursor-pointer flex flex-col items-center space-y-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span class="font-semibold text-indigo-400">${label}</span>
        <span id="${id}-label" class="text-sm text-gray-400">Click to upload a CSV file</span>
    </label>
    <input type="file" id="${id}" class="hidden" accept=".csv" />
</div>
`;

// --- Rendering Logic ---
function renderApp() {
    const appElement = document.getElementById('app');
    if (!appElement) return;

    appElement.innerHTML = AppShell;
    document.getElementById('file1-dropzone')!.innerHTML = FileInput('file1', 'Teaching Period 1 Data');
    document.getElementById('file2-dropzone')!.innerHTML = FileInput('file2', 'Teaching Period 2 Data');

    // Attach event listeners
    document.getElementById('file1')!.addEventListener('change', (e) => handleFileSelect(e, 'file1'));
    document.getElementById('file2')!.addEventListener('change', (e) => handleFileSelect(e, 'file2'));
    document.getElementById('analyze-button')!.addEventListener('click', handleAnalyze);
}

// --- Event Handlers ---
function handleFileSelect(event: Event, type: 'file1' | 'file2') {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (type === 'file1') {
        file1 = file;
    } else {
        file2 = file;
    }

    const label = document.getElementById(`${type}-label`);
    if (label) {
        label.textContent = file.name;
        label.classList.add('text-green-400');
    }

    updateAnalyzeButtonState();
}

function updateAnalyzeButtonState() {
    const button = document.getElementById('analyze-button') as HTMLButtonElement;
    if (file1 && file2) {
        button.disabled = false;
    } else {
        button.disabled = true;
    }
}

async function handleAnalyze() {
    if (!file1 || !file2) return;

    setLoading(true);
    clearResults();

    try {
        const file1Text = await file1.text();
        const file2Text = await file2.text();
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

        const prompt = `
You are a specialist content quality analyst. Your task is to compare feedback for a specific module from two different teaching periods.
First, analyze each period's feedback independently. Then, provide a comparative summary and a final list of consolidated action points.

IMPORTANT: Your analysis for both periods must focus exclusively on the quality of the content. Ignore any comments related to the trainer, instructor, presenter, or teaching style.

**Analysis for Teaching Period 1 (using the first CSV):**
1.  **Sentiment Analysis:** Calculate the percentage of positive, neutral, and negative sentiment for all content-related comments.
2.  **Thematic Analysis:** Identify the top 3-5 recurring themes related to the module's content.
3.  **Content Strengths:** Identify 2-3 key strengths of the content, supported by direct quotes.
4.  **Areas for Improvement:** Identify the top 2-3 critical areas for content improvement, with suggestions and direct quotes.

**Analysis for Teaching Period 2 (using the second CSV):**
1.  **Sentiment Analysis:** Calculate sentiment percentages.
2.  **Thematic Analysis:** Identify top recurring themes.
3.  **Content Strengths:** Identify key strengths with quotes.
4.  **Areas for Improvement:** Identify critical areas for improvement with quotes.

**Then, provide a Comparative Summary:**
Synthesize the findings from both periods. Highlight key trends, changes in sentiment, recurring vs. new themes, and whether issues from Period 1 were addressed or persisted in Period 2.

**Finally, provide Consolidated Action Points:**
Based on the *entire* analysis of both periods, create a list of the 3-5 most critical, actionable steps that should be taken to improve the module's content. For each action point, provide a brief rationale explaining why it's important, drawing from the feedback.

Return your complete analysis in the specified JSON format.

Teaching Period 1 CSV:
\`\`\`csv
${file1Text}
\`\`\`

Teaching Period 2 CSV:
\`\`\`csv
${file2Text}
\`\`\`
`;
        const analysisSchema = {
            type: Type.OBJECT,
            properties: {
                sentiment: {
                    type: Type.OBJECT,
                    properties: {
                        positive: { type: Type.NUMBER },
                        neutral: { type: Type.NUMBER },
                        negative: { type: Type.NUMBER }
                    }
                },
                thematicAnalysis: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            theme: { type: Type.STRING },
                            summary: { type: Type.STRING }
                        }
                    }
                },
                contentStrengths: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            strength: { type: Type.STRING },
                            quotes: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    }
                },
                improvementAreas: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            area: { type: Type.STRING },
                            suggestion: { type: Type.STRING },
                            quotes: { type: Type.ARRAY, items: { type: Type.STRING } }
                        }
                    }
                }
            }
        };

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        comparativeSummary: { type: Type.STRING },
                        period1Analysis: analysisSchema,
                        period2Analysis: analysisSchema,
                        actionPoints: {
                           type: Type.ARRAY,
                           items: {
                               type: Type.OBJECT,
                               properties: {
                                   action: { type: Type.STRING },
                                   rationale: { type: Type.STRING }
                               }
                           }
                        }
                    }
                }
            }
        });
        
        const jsonText = response.text.trim();
        const analysisResult = JSON.parse(jsonText);

        renderResults(analysisResult);

    } catch (error) {
        console.error('Analysis failed:', error);
        showError('An error occurred during analysis. Please check the console for details and ensure your API key is configured correctly.');
    } finally {
        setLoading(false);
    }
}

// --- UI Update Functions ---
function setLoading(isLoading: boolean) {
    const spinner = document.getElementById('loading-spinner');
    const button = document.getElementById('analyze-button');
    if (isLoading) {
        spinner?.classList.remove('hidden');
        spinner?.classList.add('flex');
        button?.setAttribute('disabled', 'true');
    } else {
        spinner?.classList.add('hidden');
        spinner?.classList.remove('flex');
        updateAnalyzeButtonState();
    }
}

function showError(message: string) {
    const errorEl = document.getElementById('error-message');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

function clearResults() {
    document.getElementById('results-container')!.innerHTML = '';
    document.getElementById('error-message')!.classList.add('hidden');
}

function renderResults(data: any) {
    const container = document.getElementById('results-container');
    if (!container) return;

    const { 
        comparativeSummary,
        period1Analysis,
        period2Analysis,
        actionPoints
    } = data;

    const summaryHtml = createComparativeSummarySection(comparativeSummary);
    
    const p1Sentiment = createSentimentSection(period1Analysis.sentiment);
    const p1Themes = createThematicAnalysisSection(period1Analysis.thematicAnalysis);
    const p1Strengths = createStrengthsSection(period1Analysis.contentStrengths);
    const p1Improvements = createImprovementAreasSection(period1Analysis.improvementAreas);

    const p2Sentiment = createSentimentSection(period2Analysis.sentiment);
    const p2Themes = createThematicAnalysisSection(period2Analysis.thematicAnalysis);
    const p2Strengths = createStrengthsSection(period2Analysis.contentStrengths);
    const p2Improvements = createImprovementAreasSection(period2Analysis.improvementAreas);
    
    const actionPointsHtml = createActionPointsSection(actionPoints);

    container.innerHTML = `
        ${summaryHtml}
        <div class="grid md:grid-cols-2 gap-x-8 gap-y-6 mt-8">
            <!-- Period 1 Column -->
            <div class="space-y-6">
                <div class="sticky top-4 bg-gray-900/80 backdrop-blur-sm py-2 z-10 rounded-lg">
                    <h2 class="text-3xl font-bold text-center text-indigo-400">Teaching Period 1</h2>
                </div>
                ${p1Sentiment}
                ${p1Themes}
                ${p1Strengths}
                ${p1Improvements}
            </div>
            <!-- Period 2 Column -->
            <div class="space-y-6">
                 <div class="sticky top-4 bg-gray-900/80 backdrop-blur-sm py-2 z-10 rounded-lg">
                    <h2 class="text-3xl font-bold text-center text-purple-400">Teaching Period 2</h2>
                </div>
                ${p2Sentiment}
                ${p2Themes}
                ${p2Strengths}
                ${p2Improvements}
            </div>
        </div>
        ${actionPointsHtml}
    `;
}

function createComparativeSummarySection(summary: string) {
    if (!summary) return '';
    return `
    <section aria-labelledby="summary-heading">
        <div class="flex items-center gap-3 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            <h2 id="summary-heading" class="text-2xl font-bold text-gray-200">Comparative Summary</h2>
        </div>
         <div class="bg-gray-800 rounded-lg p-6">
            <p class="text-gray-300 whitespace-pre-wrap">${summary}</p>
         </div>
    </section>
    `;
}

function createSentimentSection(sentiment: any) {
    if (!sentiment) return '';
    const { positive, neutral, negative } = sentiment;
    return `
    <section aria-labelledby="sentiment-heading">
        <h3 class="text-xl font-bold text-gray-300 mb-3">Sentiment Analysis</h3>
        <div class="bg-gray-800 rounded-lg p-6 space-y-4">
            <div class="flex justify-between items-center">
                <span class="text-green-400 font-semibold">Positive</span>
                <span class="text-lg font-bold">${positive.toFixed(1)}%</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-gray-400 font-semibold">Neutral</span>
                <span class="text-lg font-bold">${neutral.toFixed(1)}%</span>
            </div>
            <div class="flex justify-between items-center">
                <span class="text-red-400 font-semibold">Negative</span>
                <span class="text-lg font-bold">${negative.toFixed(1)}%</span>
            </div>
        </div>
    </section>
    `;
}

function createThematicAnalysisSection(themes: any[]) {
    if (!themes || themes.length === 0) return '';
    return `
     <section aria-labelledby="themes-heading">
        <h3 class="text-xl font-bold text-gray-300 mb-3">Key Themes</h3>
        <div class="bg-gray-800 rounded-lg p-6 space-y-4">
            ${themes.map(item => `
                <div>
                    <h4 class="font-bold text-indigo-400">${item.theme}</h4>
                    <p class="text-gray-300 text-sm">${item.summary}</p>
                </div>
            `).join('')}
        </div>
    </section>
    `;
}

function createStrengthsSection(strengths: any[]) {
    if (!strengths || strengths.length === 0) return '';
    return `
    <section aria-labelledby="strengths-heading">
        <h3 class="text-xl font-bold text-gray-300 mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            Content Strengths
        </h3>
        <div class="space-y-4">
            ${strengths.map(item => `
                <div class="bg-gray-800 rounded-lg p-6">
                    <h4 class="font-bold text-lg text-green-400 mb-2">${item.strength}</h4>
                    <div class="space-y-3 mt-4">
                        ${item.quotes.map((quote: string) => `
                            <blockquote class="border-l-4 border-green-600 pl-4 py-1 bg-black/20 rounded-r-md">
                                <p class="italic text-gray-400">"${quote}"</p>
                            </blockquote>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    `;
}

function createImprovementAreasSection(improvementData: any[]) {
    if (!improvementData || improvementData.length === 0) return '';
    return `
    <section aria-labelledby="improvement-heading">
        <h3 class="text-xl font-bold text-gray-300 mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 3.001-1.742 3.001H4.42c-1.53 0-2.493-1.667-1.743-3.001l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
            </svg>
            Areas for Improvement
        </h3>
        <div class="space-y-6">
            ${improvementData.map(area => `
                <div class="bg-gray-800 rounded-lg p-6">
                    <h4 class="font-bold text-lg text-yellow-400 mb-2">${area.area}</h4>
                    <p class="text-gray-300 mb-4">${area.suggestion}</p>
                    <h5 class="font-semibold text-gray-400 mb-2 text-sm">Supporting Feedback:</h5>
                     <div class="space-y-3">
                        ${area.quotes.map((quote: string) => `
                            <blockquote class="border-l-4 border-yellow-600 pl-4 py-1 bg-black/20 rounded-r-md">
                                <p class="italic text-gray-400">"${quote}"</p>
                            </blockquote>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        </div>
    </section>
    `;
}

function createActionPointsSection(actions: any[]) {
    if (!actions || actions.length === 0) return '';
    return `
    <section aria-labelledby="actions-heading" class="mt-12">
        <div class="flex items-center gap-3 mb-4">
             <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
             </svg>
            <h2 id="actions-heading" class="text-2xl font-bold text-gray-200">Consolidated Action Points</h2>
        </div>
         <div class="bg-gray-800 rounded-lg p-6 divide-y divide-gray-700">
            ${actions.map(point => `
                <div class="py-4 first:pt-0 last:pb-0">
                    <h3 class="font-bold text-lg text-indigo-300">${point.action}</h3>
                    <p class="text-gray-400 mt-1">${point.rationale}</p>
                </div>
            `).join('')}
         </div>
    </section>
    `;
}


// --- Initial Render ---
renderApp();