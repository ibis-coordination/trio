import type { AggregationMethod, EnsembleModel, EnsembleMember } from '../types';

export interface ModelConfigState {
  mode: 'simple' | 'ensemble';
  simpleModel: string;
  ensemble: EnsembleMember[];
  aggregationMethod: AggregationMethod;
  judgeModel: string;
  synthesizeModel: string;
}

export class ModelConfig {
  private container: HTMLElement;
  private state: ModelConfigState;
  private onChange: (state: ModelConfigState) => void;

  constructor(container: HTMLElement, initialState: ModelConfigState, onChange: (state: ModelConfigState) => void) {
    this.container = container;
    this.state = initialState;
    this.onChange = onChange;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = '';
    this.container.className = 'model-config';
    this.container.setAttribute('data-testid', 'model-config');

    // Mode toggle
    const modeToggle = document.createElement('div');
    modeToggle.className = 'config-section';
    modeToggle.innerHTML = `
      <label class="config-label">Mode:</label>
      <select data-testid="mode-select" class="config-select">
        <option value="simple" ${this.state.mode === 'simple' ? 'selected' : ''}>Simple (single model)</option>
        <option value="ensemble" ${this.state.mode === 'ensemble' ? 'selected' : ''}>Ensemble</option>
      </select>
    `;
    this.container.appendChild(modeToggle);

    const modeSelect = modeToggle.querySelector('select')!;
    modeSelect.addEventListener('change', () => {
      this.state.mode = modeSelect.value as 'simple' | 'ensemble';
      this.onChange(this.state);
      this.render();
    });

    if (this.state.mode === 'simple') {
      this.renderSimpleMode();
    } else {
      this.renderEnsembleMode();
    }
  }

  private renderSimpleMode(): void {
    const section = document.createElement('div');
    section.className = 'config-section';
    section.innerHTML = `
      <label class="config-label">Model:</label>
      <input type="text" data-testid="simple-model-input" class="config-input"
             value="${this.state.simpleModel}" placeholder="e.g., gpt-4, claude-3-opus">
    `;
    this.container.appendChild(section);

    const input = section.querySelector('input')!;
    input.addEventListener('input', () => {
      this.state.simpleModel = input.value;
      this.onChange(this.state);
    });
  }

  private renderEnsembleMode(): void {
    // Aggregation method
    const aggSection = document.createElement('div');
    aggSection.className = 'config-section';
    aggSection.innerHTML = `
      <label class="config-label">Aggregation:</label>
      <select data-testid="aggregation-select" class="config-select">
        <option value="acceptance_voting" ${this.state.aggregationMethod === 'acceptance_voting' ? 'selected' : ''}>Acceptance Voting</option>
        <option value="random" ${this.state.aggregationMethod === 'random' ? 'selected' : ''}>Random</option>
        <option value="judge" ${this.state.aggregationMethod === 'judge' ? 'selected' : ''}>Judge</option>
        <option value="synthesize" ${this.state.aggregationMethod === 'synthesize' ? 'selected' : ''}>Synthesize</option>
        <option value="concat" ${this.state.aggregationMethod === 'concat' ? 'selected' : ''}>Concat</option>
      </select>
    `;
    this.container.appendChild(aggSection);

    const aggSelect = aggSection.querySelector('select')!;
    aggSelect.addEventListener('change', () => {
      this.state.aggregationMethod = aggSelect.value as AggregationMethod;
      this.onChange(this.state);
      this.render();
    });

    // Judge model (if judge aggregation)
    if (this.state.aggregationMethod === 'judge') {
      const judgeSection = document.createElement('div');
      judgeSection.className = 'config-section';
      judgeSection.innerHTML = `
        <label class="config-label">Judge Model:</label>
        <input type="text" data-testid="judge-model-input" class="config-input"
               value="${this.state.judgeModel}" placeholder="e.g., gpt-4">
      `;
      this.container.appendChild(judgeSection);

      const input = judgeSection.querySelector('input')!;
      input.addEventListener('input', () => {
        this.state.judgeModel = input.value;
        this.onChange(this.state);
      });
    }

    // Synthesize model (if synthesize aggregation)
    if (this.state.aggregationMethod === 'synthesize') {
      const synthSection = document.createElement('div');
      synthSection.className = 'config-section';
      synthSection.innerHTML = `
        <label class="config-label">Synthesize Model:</label>
        <input type="text" data-testid="synthesize-model-input" class="config-input"
               value="${this.state.synthesizeModel}" placeholder="e.g., gpt-4">
      `;
      this.container.appendChild(synthSection);

      const input = synthSection.querySelector('input')!;
      input.addEventListener('input', () => {
        this.state.synthesizeModel = input.value;
        this.onChange(this.state);
      });
    }

    // Ensemble members
    const membersSection = document.createElement('div');
    membersSection.className = 'config-section';
    membersSection.innerHTML = `<label class="config-label">Ensemble Members:</label>`;

    const membersList = document.createElement('div');
    membersList.className = 'members-list';
    membersList.setAttribute('data-testid', 'ensemble-members');

    this.state.ensemble.forEach((member, index) => {
      const memberEl = document.createElement('div');
      memberEl.className = 'member-item';
      memberEl.innerHTML = `
        <input type="text" data-testid="member-model-${index}" class="config-input member-model"
               value="${typeof member.model === 'string' ? member.model : '[nested ensemble]'}"
               placeholder="Model name">
        <input type="text" data-testid="member-prompt-${index}" class="config-input member-prompt"
               value="${member.system_prompt || ''}" placeholder="System prompt (optional)">
        <button type="button" data-testid="remove-member-${index}" class="remove-member-btn">x</button>
      `;
      membersList.appendChild(memberEl);

      const modelInput = memberEl.querySelector('.member-model') as HTMLInputElement;
      const promptInput = memberEl.querySelector('.member-prompt') as HTMLInputElement;
      const removeBtn = memberEl.querySelector('.remove-member-btn')!;

      modelInput.addEventListener('input', () => {
        this.state.ensemble[index].model = modelInput.value;
        this.onChange(this.state);
      });

      promptInput.addEventListener('input', () => {
        this.state.ensemble[index].system_prompt = promptInput.value || undefined;
        this.onChange(this.state);
      });

      removeBtn.addEventListener('click', () => {
        this.state.ensemble.splice(index, 1);
        this.onChange(this.state);
        this.render();
      });
    });

    membersSection.appendChild(membersList);

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'add-member-btn';
    addBtn.setAttribute('data-testid', 'add-member-btn');
    addBtn.textContent = '+ Add Member';
    addBtn.addEventListener('click', () => {
      this.state.ensemble.push({ model: '' });
      this.onChange(this.state);
      this.render();
    });
    membersSection.appendChild(addBtn);

    this.container.appendChild(membersSection);
  }

  getModel(): string | EnsembleModel {
    if (this.state.mode === 'simple') {
      return this.state.simpleModel;
    }

    const ensemble: EnsembleModel = {
      ensemble: this.state.ensemble.filter(m => typeof m.model === 'string' && m.model.trim() !== ''),
      aggregation_method: this.state.aggregationMethod,
    };

    if (this.state.aggregationMethod === 'judge' && this.state.judgeModel) {
      ensemble.judge_model = this.state.judgeModel;
    }

    if (this.state.aggregationMethod === 'synthesize' && this.state.synthesizeModel) {
      ensemble.synthesize_model = this.state.synthesizeModel;
    }

    return ensemble;
  }
}
