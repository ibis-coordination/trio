import type { VotingDetails as VotingDetailsType } from '../types';

export class VotingDetails {
  private container: HTMLElement;
  private contentEl: HTMLElement;
  private isExpanded: boolean = false;

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.className = 'voting-details';
    this.container.setAttribute('data-testid', 'voting-details');

    const header = document.createElement('button');
    header.className = 'voting-details-header';
    header.setAttribute('data-testid', 'voting-details-toggle');
    header.innerHTML = '<span class="toggle-icon">+</span> Voting Details';
    header.addEventListener('click', () => this.toggle());

    this.contentEl = document.createElement('div');
    this.contentEl.className = 'voting-details-content';
    this.contentEl.style.display = 'none';

    this.container.appendChild(header);
    this.container.appendChild(this.contentEl);
  }

  private toggle(): void {
    this.isExpanded = !this.isExpanded;
    this.contentEl.style.display = this.isExpanded ? 'block' : 'none';
    const toggleIcon = this.container.querySelector('.toggle-icon')!;
    toggleIcon.textContent = this.isExpanded ? '-' : '+';
  }

  render(details: VotingDetailsType | null): void {
    if (!details) {
      this.container.style.display = 'none';
      return;
    }

    this.container.style.display = 'block';
    this.contentEl.innerHTML = '';

    // Aggregation method
    const methodEl = document.createElement('div');
    methodEl.className = 'voting-method';
    methodEl.innerHTML = `<strong>Aggregation:</strong> ${details.aggregation_method}`;
    this.contentEl.appendChild(methodEl);

    // Candidates
    const candidatesEl = document.createElement('div');
    candidatesEl.className = 'voting-candidates';
    candidatesEl.innerHTML = '<strong>Candidates:</strong>';

    details.candidates.forEach((candidate, index) => {
      const candidateEl = document.createElement('div');
      candidateEl.className = `voting-candidate ${index === details.winner_index ? 'winner' : ''}`;
      candidateEl.setAttribute('data-testid', `candidate-${index}`);

      const headerEl = document.createElement('div');
      headerEl.className = 'candidate-header';
      headerEl.innerHTML = `
        <span class="candidate-model">${candidate.model}</span>
        ${index === details.winner_index ? '<span class="winner-badge">Winner</span>' : ''}
        <span class="candidate-votes">Accepted: ${candidate.accepted} | Preferred: ${candidate.preferred}</span>
      `;

      const responseEl = document.createElement('div');
      responseEl.className = 'candidate-response';
      responseEl.textContent = candidate.response.length > 200
        ? candidate.response.substring(0, 200) + '...'
        : candidate.response;

      // Expand button for long responses
      if (candidate.response.length > 200) {
        const expandBtn = document.createElement('button');
        expandBtn.className = 'expand-response-btn';
        expandBtn.textContent = 'Show more';
        expandBtn.addEventListener('click', () => {
          if (responseEl.textContent === candidate.response) {
            responseEl.textContent = candidate.response.substring(0, 200) + '...';
            expandBtn.textContent = 'Show more';
          } else {
            responseEl.textContent = candidate.response;
            expandBtn.textContent = 'Show less';
          }
        });
        candidateEl.appendChild(headerEl);
        candidateEl.appendChild(responseEl);
        candidateEl.appendChild(expandBtn);
      } else {
        candidateEl.appendChild(headerEl);
        candidateEl.appendChild(responseEl);
      }

      candidatesEl.appendChild(candidateEl);
    });

    this.contentEl.appendChild(candidatesEl);
  }

  clear(): void {
    this.container.style.display = 'none';
    this.contentEl.innerHTML = '';
  }
}
