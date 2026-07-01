/**
 * UI 元件測試範例
 * 示範如何使用 React Testing Library 測試 React 元件
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

describe('Badge 元件', () => {
  it('渲染 children', () => {
    render(<Badge>測試</Badge>);
    expect(screen.getByText('測試')).toBeInTheDocument();
  });

  it('套用 variant 樣式', () => {
    const { container } = render(<Badge variant="success">成功</Badge>);
    expect(container.querySelector('.text-green-800')).toBeInTheDocument();
  });

  it('支援自訂 style', () => {
    const { container } = render(<Badge style={{ backgroundColor: 'red' }}>自訂</Badge>);
    const span = container.querySelector('span');
    // jsdom 將 inline style 標準化為 CSS 字串
    expect(span?.getAttribute('style')).toContain('background-color');
  });
});

describe('Button 元件', () => {
  it('點擊觸發 onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>按我</Button>);
    await user.click(screen.getByText('按我'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('disabled 時不觸發 onClick', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>按我</Button>);
    await user.click(screen.getByText('按我'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ReportButton 元件', () => {
  it('點擊後展開選單', async () => {
    const user = userEvent.setup();
    const { ReportButton } = await import('@/components/ReportButton');
    render(
      <ReportButton
        label="測試匯出"
        generate={() => ({
          title: '測試',
          columns: [],
          rows: [],
          filename: 'test',
        })}
      />
    );

    await user.click(screen.getByText('測試匯出'));
    expect(screen.getByText('匯出 PDF')).toBeInTheDocument();
    expect(screen.getByText('匯出 Excel')).toBeInTheDocument();
    expect(screen.getByText('匯出 CSV')).toBeInTheDocument();
  });
});
