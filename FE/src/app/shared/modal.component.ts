import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    <div class="modal-backdrop" (click)="close.emit()">
      <div class="modal" [class.modal-lg]="size() === 'lg'" [class.modal-sm]="size() === 'sm'" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>{{ title() }}</h3>
          <button class="icon-btn" (click)="close.emit()" aria-label="Tutup">✕</button>
        </div>
        <div class="modal-body"><ng-content /></div>
        <ng-content select="[footer]" />
      </div>
    </div>
  `,
})
export class ModalComponent {
  title = input('');
  size = input<'sm' | 'md' | 'lg'>('md');
  close = output<void>();
}
