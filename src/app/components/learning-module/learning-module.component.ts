import { Component, inject, signal, OnInit, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LearningAgentService, ChatMessage } from '../../services/learning.service';
import { AuthService } from '../../services/auth.service';
import { PythonExecutionService, ExecutionResult } from '../../services/python-execution.service';
import { CodeAttemptService } from '../../services/code-attempt.service';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MonacoEditorModule } from 'ngx-monaco-editor-v2';
import { getExecutionSummary } from './learning-workspace-state';

@Component({
  selector: 'app-learning-module',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MonacoEditorModule],
  template: `
    <div class="flex h-full w-full flex-col overflow-hidden bg-[#081425] text-[#d8e3fb]">
      <div class="shrink-0 px-4 pt-4 md:px-5 md:pt-5">
        <div class="sanctuary-card rounded-[2rem] px-5 py-5 md:px-6">
          <div class="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div class="max-w-3xl">
              <p class="text-[0.68rem] uppercase tracking-[0.3em] text-[#859490]">Learning studio</p>
              <h1 class="mt-3 text-3xl font-bold md:text-4xl">Code, guidance, and documentation now move as one workflow.</h1>
              <p class="mt-4 text-sm leading-8 text-[#bbcac6] md:text-base">
                Start with a lesson brief, work inside the editor, and keep AI coaching visible without forcing context switches or burying the reference material.
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-3 xl:min-w-[26rem]">
              <div class="rounded-[1.4rem] bg-[#111c2d] px-4 py-4">
                <p class="text-[0.64rem] uppercase tracking-[0.18em] text-[#859490]">Runtime</p>
                <p class="mt-2 text-sm font-semibold">{{ pythonService.isReady() ? 'Python ready' : 'Preparing runtime' }}</p>
              </div>
              <div class="rounded-[1.4rem] bg-[#111c2d] px-4 py-4">
                <p class="text-[0.64rem] uppercase tracking-[0.18em] text-[#859490]">Conversation</p>
                <p class="mt-2 text-sm font-semibold">{{ chatMessages().length }} messages</p>
              </div>
              <div class="rounded-[1.4rem] bg-[#111c2d] px-4 py-4">
                <p class="text-[0.64rem] uppercase tracking-[0.18em] text-[#859490]">Execution</p>
                <p class="mt-2 text-sm font-semibold">{{ executionSummary() }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="flex-1 overflow-hidden p-4 md:p-5">
        <div class="grid h-full gap-4 xl:grid-cols-[18rem_minmax(0,1fr)_24rem]">
          <aside class="sanctuary-card h-full flex-col overflow-hidden rounded-[2rem] xl:flex"
            [class.flex]="activeMobileTab() === 'brief'"
            [class.hidden]="activeMobileTab() !== 'brief'">
            <div class="shrink-0 px-5 py-5">
              <p class="text-[0.66rem] uppercase tracking-[0.28em] text-[#859490]">Learning map</p>
              <h2 class="mt-2 text-2xl font-bold">Briefing</h2>
              <p class="mt-2 text-sm leading-7 text-[#bbcac6]">Documentation is now embedded as a study rail instead of a detached side note.</p>
            </div>

            <div class="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
              <div class="rounded-[1.4rem] bg-[#111c2d] p-4">
                <p class="text-[0.62rem] uppercase tracking-[0.18em] text-[#859490]">Lesson brief</p>
                @if (moduleContent()) {
                  <div class="prose prose-invert prose-sm mt-3 max-w-none text-sm">
                    <div [innerHTML]="formatContent(moduleContent())"></div>
                  </div>
                } @else {
                  <p class="mt-3 text-sm leading-7 text-[#859490]">Start with a prompt and the lesson brief will stay anchored here while you work.</p>
                }
              </div>

              <div class="rounded-[1.4rem] bg-[#111c2d] p-4">
                <p class="text-[0.62rem] uppercase tracking-[0.18em] text-[#859490]">Quick prompts</p>
                <div class="mt-3 flex flex-wrap gap-2">
                  @for (prompt of quickPrompts; track prompt) {
                    <button (click)="usePrompt(prompt)" class="rounded-full bg-[#081425] px-3 py-2 text-left text-xs text-[#d8e3fb] transition-colors hover:bg-[#1f2a3c]">
                      {{ prompt }}
                    </button>
                  }
                </div>
              </div>

              <div class="rounded-[1.4rem] bg-[#111c2d] p-4">
                <p class="text-[0.62rem] uppercase tracking-[0.18em] text-[#859490]">Reference cards</p>
                <div class="mt-3 space-y-3 text-sm leading-7 text-[#bbcac6]">
                  <div class="rounded-[1rem] bg-[#081425] px-3 py-3">
                    <strong class="block text-[#d8e3fb]">Explain</strong>
                    Ask the coach to break down syntax, trace logic, or reframe a concept with simpler examples.
                  </div>
                  <div class="rounded-[1rem] bg-[#081425] px-3 py-3">
                    <strong class="block text-[#d8e3fb]">Practice</strong>
                    Use the editor as the main surface and keep the reference rail visible while iterating.
                  </div>
                  <div class="rounded-[1rem] bg-[#081425] px-3 py-3">
                    <strong class="block text-[#d8e3fb]">Reflect</strong>
                    Review output states below the editor and use the coach for targeted debugging.
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <section class="sanctuary-card h-full min-h-0 flex-col overflow-hidden rounded-[2rem] xl:flex"
            [class.flex]="activeMobileTab() === 'workspace'"
            [class.hidden]="activeMobileTab() !== 'workspace'">
            <div class="shrink-0 border-b border-white/5 px-5 py-5 md:px-6">
              <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p class="text-[0.66rem] uppercase tracking-[0.28em] text-[#859490]">Workspace</p>
                  <h2 class="mt-2 text-3xl font-bold">Code studio</h2>
                  <p class="mt-2 text-sm leading-7 text-[#bbcac6]">The editor is primary; output stays attached beneath it so the learning loop is visible.</p>
                </div>
                <div class="flex flex-wrap items-center gap-3">
                  <div class="flex rounded-full bg-[#111c2d] p-1 xl:hidden">
                    <button (click)="activeView.set('edit')"
                      [class.bg-[#1f2a3c]]="activeView() === 'edit'"
                      [class.text-[#d8e3fb]]="activeView() === 'edit'"
                      [class.text-[#859490]]="activeView() !== 'edit'"
                      class="rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] transition-colors">
                      Edit
                    </button>
                    <button (click)="activeView.set('compiled')"
                      [class.bg-[#1f2a3c]]="activeView() === 'compiled'"
                      [class.text-[#d8e3fb]]="activeView() === 'compiled'"
                      [class.text-[#859490]]="activeView() !== 'compiled'"
                      class="rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.16em] transition-colors">
                      Output
                    </button>
                  </div>
                  <button (click)="runCode()" [disabled]="isExecuting() || !pythonService.isReady()"
                    class="sanctuary-button flex items-center justify-center gap-2 rounded-[1.4rem] px-5 py-4 text-sm font-semibold disabled:opacity-50">
                    @if (isExecuting()) {
                      <mat-icon class="h-4 w-4 animate-spin text-[16px]">refresh</mat-icon> Running
                    } @else {
                      <mat-icon class="h-4 w-4 text-[16px]">play_arrow</mat-icon> Run code
                    }
                  </button>
                </div>
              </div>
            </div>

            <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:p-5">
              <div class="hidden grid-cols-[minmax(0,1fr)_15rem] gap-4 xl:grid">
                <div class="rounded-[1.25rem] bg-[#111c2d] px-4 py-4 text-sm leading-7 text-[#bbcac6]">
                  <span class="text-[0.62rem] uppercase tracking-[0.18em] text-[#859490]">Current focus</span>
                  <p class="mt-2">{{ topic || 'Use a quick prompt or ask the coach for a new lesson focus.' }}</p>
                </div>
                <div class="rounded-[1.25rem] bg-[#111c2d] px-4 py-4 text-sm">
                  <span class="text-[0.62rem] uppercase tracking-[0.18em] text-[#859490]">Latest run</span>
                  <p class="mt-2 font-semibold text-[#d8e3fb]">{{ executionSummary() }}</p>
                </div>
              </div>

              <div class="relative min-h-0 flex-1 rounded-[1.5rem] bg-[#040e1f]">
                <div class="flex items-center justify-between px-4 py-3 text-xs text-[#859490]">
                  <div class="flex gap-1.5">
                    <div class="h-2.5 w-2.5 rounded-full bg-[#ffb4ab]/50"></div>
                    <div class="h-2.5 w-2.5 rounded-full bg-[#ffb59e]/50"></div>
                    <div class="h-2.5 w-2.5 rounded-full bg-[#4fdbc8]/50"></div>
                  </div>
                  <span class="font-mono">main.py</span>
                </div>
                <div class="absolute inset-x-0 bottom-0 top-9">
                  <div class="h-full" [class.hidden]="activeView() !== 'edit' && !isDesktopWorkspace()">
                    <ngx-monaco-editor [options]="editorOptions" [(ngModel)]="code" class="h-full min-h-0 w-full"></ngx-monaco-editor>
                  </div>
                </div>
              </div>

              <div class="hidden min-h-[15rem] flex-col overflow-hidden rounded-[1.5rem] bg-[#111c2d] xl:flex">
                <div class="flex shrink-0 items-center justify-between px-5 py-4">
                  <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#859490]">
                    <mat-icon class="h-3 w-3 text-[12px]">terminal</mat-icon> Output dock
                  </div>
                  @if (outputResult()) {
                    <div class="flex items-center gap-3">
                      <span class="rounded-full px-2.5 py-1 text-[10px] font-medium"
                        [class.bg-[#ffb4ab]/12]="outputResult()?.error"
                        [class.text-[#ffb4ab]]="outputResult()?.error"
                        [class.bg-[#4fdbc8]/12]="!outputResult()?.error"
                        [class.text-[#4fdbc8]]="!outputResult()?.error">
                        {{ outputResult()?.error ? 'Failed' : 'Success' }}
                      </span>
                      <div class="flex items-center gap-1 font-mono text-[10px] text-[#859490]">
                        <mat-icon class="h-3 w-3 text-[12px]">timer</mat-icon> {{ outputResult()?.duration }}ms
                      </div>
                    </div>
                  }
                </div>
                <div class="relative flex-1">
                  <ng-container *ngTemplateOutlet="outputPanel"></ng-container>
                </div>
              </div>

              <div class="relative min-h-[16rem] flex-1 rounded-[1.5rem] bg-[#111c2d] xl:hidden" [class.hidden]="activeView() !== 'compiled'">
                <div class="flex shrink-0 items-center justify-between px-5 py-4">
                  <div class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#859490]">
                    <mat-icon class="h-3 w-3 text-[12px]">terminal</mat-icon> Output
                  </div>
                </div>
                <div class="absolute inset-x-0 bottom-0 top-12">
                  <ng-container *ngTemplateOutlet="outputPanel"></ng-container>
                </div>
              </div>
            </div>
          </section>

          <aside class="sanctuary-card h-full flex-col overflow-hidden rounded-[2rem] xl:flex"
            [class.flex]="activeMobileTab() === 'coach'"
            [class.hidden]="activeMobileTab() !== 'coach'">
            <div class="shrink-0 px-5 py-5">
              <p class="text-[0.66rem] uppercase tracking-[0.28em] text-[#859490]">Coach</p>
              <h2 class="mt-2 text-2xl font-bold">AI conversation</h2>
              <p class="mt-2 text-sm leading-7 text-[#bbcac6]">The assistant stays visible as a collaborator instead of replacing the rest of the learning surface.</p>
            </div>

            <div class="shrink-0 px-4">
              <div class="flex flex-wrap gap-2">
                <button (click)="usePrompt('Give me a hint without solving it')" class="rounded-full bg-[#111c2d] px-3 py-2 text-xs text-[#d8e3fb] transition-colors hover:bg-[#1f2a3c]">Hint</button>
                <button (click)="usePrompt('Explain what the last output means')" class="rounded-full bg-[#111c2d] px-3 py-2 text-xs text-[#d8e3fb] transition-colors hover:bg-[#1f2a3c]">Interpret output</button>
                <button (click)="usePrompt('What should I practice next?')" class="rounded-full bg-[#111c2d] px-3 py-2 text-xs text-[#d8e3fb] transition-colors hover:bg-[#1f2a3c]">Next step</button>
              </div>
            </div>

            <div class="mt-4 flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
              @for (msg of chatMessages(); track msg.id || $index) {
                <div class="flex flex-col gap-2" [class.items-end]="msg.role === 'user'">
                  <span class="text-[0.62rem] uppercase tracking-[0.18em] text-[#859490]">{{ msg.role === 'user' ? 'You' : 'Coach' }}</span>
                  <div class="max-w-[94%] rounded-[1.25rem] p-4 text-sm leading-7"
                       [class.bg-[#4fdbc8]]="msg.role === 'user'"
                       [class.text-[#003731]]="msg.role === 'user'"
                       [class.bg-[#111c2d]]="msg.role === 'model'"
                       [class.text-[#d8e3fb]]="msg.role === 'model'">
                    <div [innerHTML]="formatContent(msg.content)"></div>
                  </div>
                </div>
              }

              @if (isLoading()) {
                <div class="flex flex-col items-start gap-2">
                  <span class="text-[0.62rem] uppercase tracking-[0.18em] text-[#859490]">Coach</span>
                  <div class="flex max-w-[94%] items-center gap-2 rounded-[1.25rem] bg-[#111c2d] p-4 text-sm text-[#d8e3fb]">
                    <mat-icon class="h-4 w-4 animate-spin text-[16px] text-[#4fdbc8]">autorenew</mat-icon> Thinking...
                  </div>
                </div>
              }
            </div>

            <div class="shrink-0 px-4 pb-4">
              <div class="rounded-[1.4rem] bg-[#111c2d] p-3">
                <textarea [(ngModel)]="topic" rows="3" (keyup.enter)="sendMessage()" placeholder="Ask a question, request a hint, or start a lesson..."
                  class="w-full resize-none bg-transparent text-sm text-[#d8e3fb] placeholder:text-[#859490] focus:outline-none"></textarea>
                <div class="mt-3 flex items-center justify-between">
                  <span class="text-[0.62rem] uppercase tracking-[0.18em] text-[#859490]">Enter to send</span>
                  <button (click)="sendMessage()" [disabled]="!topic || isLoading()"
                    class="sanctuary-button flex items-center justify-center rounded-full p-3 transition-opacity disabled:opacity-50">
                    <mat-icon class="h-5 w-5 text-[20px]">send</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <ng-template #outputPanel>
        @if (!pythonService.isReady()) {
          <div class="flex items-center gap-2 p-4 font-mono text-xs text-[#ffb4ab]">
            <mat-icon class="h-4 w-4 animate-spin text-[16px]">refresh</mat-icon> Initializing Python...
          </div>
        } @else if (isExecuting()) {
          <div class="flex items-center gap-2 p-4 font-mono text-xs text-[#4fdbc8]">
            <mat-icon class="h-4 w-4 animate-spin text-[16px]">autorenew</mat-icon> Executing code...
          </div>
        } @else if (outputResult()) {
          @if (outputResult()?.error || outputResult()?.stderr) {
            <div class="absolute inset-0 overflow-y-auto p-4 pb-8 font-mono text-xs">
              @if (outputResult()?.stdout) {
                <div class="mb-4">
                  <div class="mb-1 text-[10px] uppercase tracking-[0.22em] text-[#859490]">Standard Output</div>
                  <pre class="whitespace-pre-wrap text-[#d8e3fb]">{{ outputResult()?.stdout }}</pre>
                </div>
              }
              @if (outputResult()?.stderr) {
                <div class="mb-4">
                  <div class="mb-1 text-[10px] uppercase tracking-[0.22em] text-[#ffb59e]">Standard Error</div>
                  <pre class="whitespace-pre-wrap text-[#ffb59e]">{{ outputResult()?.stderr }}</pre>
                </div>
              }
              @if (outputResult()?.error) {
                <div>
                  <div class="mb-1 text-[10px] uppercase tracking-[0.22em] text-[#ffb4ab]">Exception</div>
                  <div class="rounded-[1rem] bg-[#081425] p-4">
                    <pre class="whitespace-pre-wrap text-[#ffb4ab]">{{ outputResult()?.error }}</pre>
                  </div>
                </div>
              }
            </div>
          } @else if (outputResult()?.stdout) {
            <ngx-monaco-editor [options]="outputEditorOptions" [ngModel]="outputResult()?.stdout" class="absolute inset-0"></ngx-monaco-editor>
          } @else {
            <div class="p-4 font-mono text-xs italic text-[#859490]">Execution completed with no output.</div>
          }
        } @else {
          <div class="p-4 font-mono text-xs italic text-[#859490]">Run your code to see the output here...</div>
        }
      </ng-template>

      <div class="mx-3 mb-3 flex shrink-0 items-center justify-around rounded-[1.5rem] bg-[#152031] p-2 pb-safe xl:hidden">
        <button (click)="activeMobileTab.set('brief')"
          class="flex min-w-[72px] flex-col items-center gap-0.5 rounded-xl p-2 transition-colors"
          [class.bg-[#1f2a3c]]="activeMobileTab() === 'brief'"
          [class.text-[#4fdbc8]]="activeMobileTab() === 'brief'"
          [class.text-[#859490]]="activeMobileTab() !== 'brief'">
          <mat-icon class="h-6 w-6 text-[24px]">menu_book</mat-icon>
          <span class="text-[10px] font-medium">Brief</span>
        </button>
        <button (click)="activeMobileTab.set('workspace')"
          class="flex min-w-[72px] flex-col items-center gap-0.5 rounded-xl p-2 transition-colors"
          [class.bg-[#1f2a3c]]="activeMobileTab() === 'workspace'"
          [class.text-[#4fdbc8]]="activeMobileTab() === 'workspace'"
          [class.text-[#859490]]="activeMobileTab() !== 'workspace'">
          <mat-icon class="h-6 w-6 text-[24px]">terminal</mat-icon>
          <span class="text-[10px] font-medium">Studio</span>
        </button>
        <button (click)="activeMobileTab.set('coach')"
          class="flex min-w-[72px] flex-col items-center gap-0.5 rounded-xl p-2 transition-colors"
          [class.bg-[#1f2a3c]]="activeMobileTab() === 'coach'"
          [class.text-[#4fdbc8]]="activeMobileTab() === 'coach'"
          [class.text-[#859490]]="activeMobileTab() !== 'coach'">
          <mat-icon class="h-6 w-6 text-[24px]">forum</mat-icon>
          <span class="text-[10px] font-medium">Coach</span>
        </button>
      </div>
    </div>
  `
})
export class LearningModuleComponent implements OnInit {
  learningService = inject(LearningAgentService);
  authService = inject(AuthService);
  pythonService = inject(PythonExecutionService);
  attemptService = inject(CodeAttemptService);
  
  topic = '';
  isLoading = signal(false);
  moduleContent = signal<string | null>(null);
  chatMessages = signal<ChatMessage[]>([]);
  quickPrompts = [
    'Teach me Python loops with a short exercise',
    'Explain variables like I am a beginner',
    'Give me a debugging challenge',
    'Show me a simple function example'
  ];

  // UI State
  activeView = signal<'edit' | 'compiled'>('edit');
  activeMobileTab = signal<'brief' | 'workspace' | 'coach'>('workspace');

  // Editor State
  code = '# Write your Python code here\nprint("Hello, LXPython!")\n';
  outputResult = signal<ExecutionResult | null>(null);
  isExecuting = signal(false);
  viewportWidth = signal(typeof window !== 'undefined' ? window.innerWidth : 1440);
  isDesktopWorkspace = computed(() => this.viewportWidth() >= 1280);

  editorOptions = {
    theme: 'vs-dark',
    language: 'python',
    minimap: { enabled: false },
    fontSize: 14,
    fontFamily: "'JetBrains Mono', monospace",
    automaticLayout: true,
    padding: { top: 16, bottom: 16 }
  };

  outputEditorOptions = {
    theme: 'vs-dark',
    language: 'python',
    readOnly: true,
    minimap: { enabled: false },
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    automaticLayout: true,
    lineNumbers: 'off',
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    folding: false,
    renderLineHighlight: 'none',
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    padding: { top: 16, bottom: 16 }
  };

  async ngOnInit() {
    await this.loadChatHistory();
  }

  @HostListener('window:resize')
  onResize() {
    if (typeof window !== 'undefined') {
      this.viewportWidth.set(window.innerWidth);
    }
  }

  async loadChatHistory() {
    try {
      const history = await this.learningService.getChatHistory();
      this.chatMessages.set(history);
      
      // If there's history, set the latest model response as module content
      const lastModelMsg = [...history].reverse().find(m => m.role === 'model');
      if (lastModelMsg) {
        this.moduleContent.set(lastModelMsg.content);
      }
    } catch (error) {
      console.error('Failed to load chat history', error);
    }
  }

  async sendMessage() {
    if (!this.topic.trim()) return;
    
    const userMessage = this.topic;
    this.topic = ''; // clear input
    
    // Optimistically add user message to UI
    this.chatMessages.update(msgs => [...msgs, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);

    this.isLoading.set(true);
    try {
      const profile = this.authService.userProfile();
      const responseText = await this.learningService.sendMessage(userMessage, profile);
      
      // Add model response to UI
      this.chatMessages.update(msgs => [...msgs, {
        role: 'model',
        content: responseText,
        timestamp: new Date().toISOString()
      }]);
      
      this.moduleContent.set(responseText);
      
      // Auto-switch to briefing on smaller layouts so the lesson remains visible
      if (this.viewportWidth() < 1280) {
        this.activeMobileTab.set('brief');
      }
    } catch (error) {
      console.error('Error sending message', error);
      this.chatMessages.update(msgs => [...msgs, {
        role: 'model',
        content: 'Sorry, there was an error processing your request. Please try again.',
        timestamp: new Date().toISOString()
      }]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async runCode() {
    if (!this.pythonService.isReady()) return;

    this.isExecuting.set(true);
    this.outputResult.set(null);
    this.activeView.set('compiled'); // Auto-switch to compiled view

    try {
      const result = await this.pythonService.runCode(this.code);
      this.outputResult.set(result);
      
      const combinedOutput = [
        result.stdout ? `STDOUT:\n${result.stdout}` : '',
        result.stderr ? `STDERR:\n${result.stderr}` : '',
        result.error ? `ERROR:\n${result.error}` : ''
      ].filter(Boolean).join('\n\n');

      // Save the attempt
      if (this.topic) {
        await this.attemptService.saveAttempt(this.topic, this.code, combinedOutput || '(No output)');
      }

      // Send execution feedback to AI
      const profile = this.authService.userProfile();
      
      // Optimistically show a loading state in chat
      this.isLoading.set(true);
      
      const feedbackResponse = await this.learningService.sendExecutionFeedback(this.code, combinedOutput || '(No output)', profile);
      
      // Add model response to UI
      this.chatMessages.update(msgs => [...msgs, {
        role: 'model',
        content: feedbackResponse,
        timestamp: new Date().toISOString()
      }]);
      
      // Auto-switch to chat tab on mobile so they see the feedback
      if (this.viewportWidth() < 1280) {
        this.activeMobileTab.set('coach');
      }

    } catch (error: unknown) {
      this.outputResult.set({
        stdout: '',
        stderr: '',
        error: error instanceof Error ? error.message : String(error),
        duration: 0
      });
    } finally {
      this.isExecuting.set(false);
    }
  }

  // Basic formatting for the markdown-like response
  formatContent(content: string | null): string {
    if (!content) return '';
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/```python([\s\S]*?)```/g, '<pre class="my-4 overflow-x-auto rounded-[1.25rem] bg-[#040e1f] p-4 font-mono text-xs text-[#d8e3fb]"><code>$1</code></pre>')
      .replace(/\n/g, '<br>');
  }

  usePrompt(prompt: string) {
    this.topic = prompt;
    void this.sendMessage();
  }

  executionSummary(): string {
    return getExecutionSummary(this.outputResult());
  }
}
