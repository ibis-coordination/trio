import type { ChatCompletionRequest, ChatCompletionResponse, VotingDetails } from './types';

export interface ChatResult {
  response: ChatCompletionResponse;
  votingDetails: VotingDetails | null;
}

export async function sendChatCompletion(request: ChatCompletionRequest): Promise<ChatResult> {
  let res: Response;

  try {
    res = await fetch('/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch (err) {
    throw new Error(`Network error: ${err instanceof Error ? err.message : 'Failed to connect'}`);
  }

  // Parse response body
  let responseBody: unknown;
  const responseText = await res.text();

  try {
    responseBody = JSON.parse(responseText);
  } catch {
    throw new Error(`Invalid JSON response: ${responseText.slice(0, 200)}`);
  }

  // Handle HTTP errors
  if (!res.ok) {
    const error = responseBody as { detail?: string };
    throw new Error(`HTTP ${res.status}: ${error.detail || responseText.slice(0, 200)}`);
  }

  const response = responseBody as ChatCompletionResponse;

  // Parse X-Trio-Details header
  const detailsHeader = res.headers.get('X-Trio-Details');
  let votingDetails: VotingDetails | null = null;

  if (detailsHeader) {
    try {
      votingDetails = JSON.parse(detailsHeader);
    } catch {
      console.warn('Failed to parse X-Trio-Details header:', detailsHeader);
    }
  }

  // Validate response has content
  if (!response.choices || response.choices.length === 0) {
    const candidateInfo = votingDetails?.candidates
      ?.map(c => `${c.model}: "${c.response?.slice(0, 50) || '(empty)'}"`)
      .join(', ');
    throw new Error(`No response generated. Candidates: ${candidateInfo || 'none'}`);
  }

  const content = response.choices[0]?.message?.content;
  if (!content || content.trim() === '') {
    throw new Error('Empty response from model. Check server logs for details.');
  }

  return { response, votingDetails };
}
