import { useState } from 'react';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  DvCheckboxGroup,
  DvFormFooter,
  DvFormPage,
  DvRadioGroup,
  DvSectionCard,
  DvSelect,
  DvStatusSelect,
  DvTextField,
  focusFirstInvalid,
  type EntityStatus,
} from '@/components/dv';
import { renderDv } from './test-utils';

describe('DvTextField', () => {
  it('renders the label above the field with a counter "0 / 240"', () => {
    renderDv(<DvTextField label="Campaign name" value="" onChange={() => {}} maxLength={240} />);
    expect(screen.getByLabelText('Campaign name')).toBeInTheDocument();
    expect(screen.getByText('0 / 240')).toBeInTheDocument();
  });

  it('formats a large counter with thousands separators', () => {
    renderDv(
      <DvTextField
        label="Notes"
        value={'x'.repeat(1234)}
        onChange={() => {}}
        maxLength={10000}
        multiline
      />,
    );
    expect(screen.getByText('1,234 / 10000')).toBeInTheDocument();
  });

  it('works controlled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(<DvTextField label="Name" value="ab" onChange={onChange} />);
    await user.type(screen.getByLabelText('Name'), 'c');
    expect(onChange).toHaveBeenCalledWith('abc');
    expect(screen.getByLabelText('Name')).toHaveValue('ab');
  });

  it('works uncontrolled with defaultValue', async () => {
    const user = userEvent.setup();
    renderDv(<DvTextField label="Name" defaultValue="ab" maxLength={10} />);
    await user.type(screen.getByLabelText('Name'), 'c');
    expect(screen.getByLabelText('Name')).toHaveValue('abc');
    expect(screen.getByText('3 / 10')).toBeInTheDocument();
  });

  it('stops typing at maxLength', async () => {
    const user = userEvent.setup();
    renderDv(<DvTextField label="Short" defaultValue="" maxLength={3} />);
    await user.type(screen.getByLabelText('Short'), 'abcdef');
    expect(screen.getByLabelText('Short')).toHaveValue('abc');
  });

  it('shows the error text, marks the field invalid and links the description', () => {
    renderDv(
      <DvTextField
        label="Budget"
        value=""
        onChange={() => {}}
        error="Enter a number greater than 0"
      />,
    );
    const input = screen.getByLabelText('Budget');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const message = screen.getByText('Enter a number greater than 0');
    expect(input).toHaveAttribute('aria-describedby', expect.stringContaining(message.id));
    expect(message).toHaveStyle({ color: 'rgb(197, 34, 31)' });
  });

  it('shows a warning as an amber banner without invalidating the field', () => {
    renderDv(
      <DvTextField
        label="KPI"
        value="1"
        onChange={() => {}}
        warning="This KPI is not recommended for the selected campaign goal."
      />,
    );
    expect(
      screen
        .getByText('This KPI is not recommended for the selected campaign goal.')
        .closest('[data-kind]'),
    ).toHaveAttribute('data-kind', 'warning');
    expect(screen.getByLabelText('KPI')).not.toHaveAttribute('aria-invalid');
  });

  it('shows the Required hint, prefix and suffix', () => {
    renderDv(
      <DvTextField
        label="Fee"
        value="5"
        onChange={() => {}}
        showRequiredHint
        prefix="₹"
        suffix="%"
      />,
    );
    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('₹')).toBeInTheDocument();
    expect(screen.getByText('%')).toBeInTheDocument();
  });

  it('locked fields are read-only with a lock icon', () => {
    renderDv(<DvTextField label="Currency" value="INR" locked />);
    const input = screen.getByLabelText('Currency');
    expect(input).toHaveAttribute('readonly');
    expect(screen.getByRole('img', { name: 'Locked' })).toBeInTheDocument();
  });

  it('disabled fields cannot be typed in', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(<DvTextField label="Name" value="" onChange={onChange} disabled />);
    await user.type(screen.getByLabelText('Name'), 'x');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Name')).toBeDisabled();
  });

  it('opens the help popover with Learn more and returns focus to the icon', async () => {
    const user = userEvent.setup();
    renderDv(
      <DvTextField label="Name" value="" onChange={() => {}} help="Up to 240 characters." />,
    );
    const help = screen.getByRole('button', { name: 'Help: Name' });
    await user.click(help);
    expect(screen.getByText('Up to 240 characters.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Up to 240 characters.')).not.toBeInTheDocument();
    expect(help).toHaveFocus();
  });
});

describe('DvSelect', () => {
  const options = [
    { value: 'a', label: 'Raise awareness', group: 'Recommended KPIs' },
    { value: 'b', label: 'Drive sales', group: 'Recommended KPIs' },
    { value: 'c', label: 'Other', group: 'Not recommended' },
  ];

  it('shows the placeholder and the grouped menu, then selects with the keyboard', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(
      <DvSelect
        label="Goal"
        value=""
        onChange={onChange}
        options={options}
        placeholder="Choose goal"
      />,
    );
    const box = screen.getByRole('combobox', { name: /Goal/ });
    expect(box).toHaveTextContent('Choose goal');
    await user.click(box);
    expect(screen.getByText('Recommended KPIs')).toBeInTheDocument();
    expect(screen.getByText('Not recommended')).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Drive sales' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('is disabled until its dependency is set', () => {
    renderDv(<DvSelect label="KPI" value="" onChange={() => {}} options={[]} disabled />);
    expect(screen.getByRole('combobox', { name: /KPI/ })).toHaveAttribute('aria-disabled', 'true');
  });

  it('shows the error text', () => {
    renderDv(
      <DvSelect
        label="Goal"
        value=""
        onChange={() => {}}
        options={options}
        error="Enter a value"
      />,
    );
    expect(screen.getByText('Enter a value')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Goal/ })).toHaveAttribute('aria-invalid', 'true');
  });

  it('filters a searchable menu', async () => {
    const user = userEvent.setup();
    renderDv(
      <DvSelect
        label="Country"
        value=""
        onChange={() => {}}
        searchable
        options={[
          { value: 'in', label: 'India', secondLine: 'IN' },
          { value: 'sg', label: 'Singapore', secondLine: 'SG' },
        ]}
      />,
    );
    await user.click(screen.getByRole('combobox', { name: /Country/ }));
    await user.type(screen.getByRole('textbox', { name: 'Search options' }), 'sing');
    expect(screen.queryByRole('option', { name: /India/ })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Singapore/ })).toBeInTheDocument();
  });
});

describe('DvRadioGroup and DvCheckboxGroup', () => {
  it('radio group selects and reports the value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(
      <DvRadioGroup
        label="Frequency"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'No limit', description: 'As often as needed' },
          { value: 'b', label: 'Limit' },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: /No limit/ })).toBeChecked();
    expect(screen.getByText('As often as needed')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Limit' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('inline inputs stay disabled until their radio is selected', () => {
    const inline = (selected: boolean) => <input aria-label="Exposures" disabled={!selected} />;
    const { rerender } = renderDv(
      <DvRadioGroup
        value="a"
        onChange={() => {}}
        options={[
          { value: 'a', label: 'No limit' },
          { value: 'b', label: 'Limit', inline },
        ]}
      />,
    );
    expect(screen.getByLabelText('Exposures')).toBeDisabled();
    rerender(
      <DvRadioGroup
        value="b"
        onChange={() => {}}
        options={[
          { value: 'a', label: 'No limit' },
          { value: 'b', label: 'Limit', inline },
        ]}
      />,
    );
    expect(screen.getByLabelText('Exposures')).toBeEnabled();
  });

  it('read-only radio group ignores clicks', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderDv(
      <DvRadioGroup
        value="a"
        readOnly
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    await user.click(screen.getByRole('radio', { name: 'B' }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('radio cards show a disabled tile with the reason', () => {
    renderDv(
      <DvRadioGroup
        variant="cards"
        label="Line item type"
        value="display"
        onChange={() => {}}
        options={[
          { value: 'display', label: 'Display', icon: 'liDisplay' },
          {
            value: 'video',
            label: 'Video',
            disabled: true,
            disabledReason:
              "Video line items aren't compatible with your insertion order's objective setting.",
          },
        ]}
      />,
    );
    expect(screen.getByRole('radio', { name: 'Video' })).toBeDisabled();
    expect(screen.getByRole('img', { name: /aren't compatible/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Display' }).closest('label')).toHaveAttribute(
      'data-selected',
      'true',
    );
  });

  it('checkbox group toggles values and shows the error', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [values, setValues] = useState<string[]>([]);
      return (
        <DvCheckboxGroup
          label="Creative types"
          values={values}
          onChange={setValues}
          error={values.length ? undefined : 'Please select at least one creative type.'}
          options={[
            { value: 'd', label: 'Display' },
            { value: 'v', label: 'Video' },
          ]}
        />
      );
    }
    renderDv(<Harness />);
    expect(screen.getByText('Please select at least one creative type.')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Display' }));
    expect(screen.getByRole('checkbox', { name: 'Display' })).toBeChecked();
    expect(screen.queryByText('Please select at least one creative type.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Display' }));
    expect(screen.getByRole('checkbox', { name: 'Display' })).not.toBeChecked();
  });
});

describe('DvSectionCard', () => {
  it('shows title, gear note and children', () => {
    renderDv(
      <DvSectionCard title="Basic details" gearNote="These settings don't impact serving.">
        <p>Body</p>
      </DvSectionCard>,
    );
    expect(screen.getByRole('heading', { name: 'Basic details' })).toBeInTheDocument();
    expect(screen.getByText("These settings don't impact serving.")).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('settings layout puts the title in a label column', () => {
    renderDv(
      <DvSectionCard title="Time zone" description="Applies to reports." layout="settings">
        <p>Control</p>
      </DvSectionCard>,
    );
    expect(screen.getByText('Applies to reports.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Time zone' })).toBeInTheDocument();
  });

  it('collapsible sections honour defaultOpen and toggle with aria-expanded', async () => {
    const user = userEvent.setup();
    renderDv(
      <DvSectionCard title="Additional settings" collapsible defaultOpen={false}>
        <p>Hidden body</p>
      </DvSectionCard>,
    );
    const toggle = screen.getByRole('button', { name: 'Additional settings' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Hidden body')).not.toBeVisible();
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Hidden body')).toBeVisible();
  });
});

describe('DvFormFooter', () => {
  it('create mode: Create, Cancel and the change note', async () => {
    const user = userEvent.setup();
    const onPrimary = vi.fn();
    const onSecondary = vi.fn();
    const onNoteChange = vi.fn();
    renderDv(
      <DvFormFooter
        mode="create"
        dirty={false}
        onPrimary={onPrimary}
        onSecondary={onSecondary}
        note=""
        onNoteChange={onNoteChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onPrimary).toHaveBeenCalledOnce();
    expect(onSecondary).toHaveBeenCalledOnce();
    await user.type(screen.getByPlaceholderText('Optional: Enter a note about this change'), 'x');
    expect(onNoteChange).toHaveBeenCalledWith('x');
  });

  it('edit mode: Save and Reset are disabled while clean and enabled when dirty', () => {
    const { rerender } = renderDv(
      <DvFormFooter
        mode="edit"
        dirty={false}
        onPrimary={() => {}}
        onSecondary={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
    rerender(
      <DvFormFooter
        mode="edit"
        dirty
        onPrimary={() => {}}
        onSecondary={() => {}}
        onReset={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Reset' })).toBeEnabled();
  });

  it('panel mode shows Apply and Cancel and no change note', () => {
    renderDv(
      <DvFormFooter
        mode="panel"
        dirty
        onPrimary={() => {}}
        onSecondary={() => {}}
        note=""
        onNoteChange={() => {}}
      />,
    );
    expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText('Optional: Enter a note about this change'),
    ).not.toBeInTheDocument();
  });

  it('supports a custom primary label and an extra right-hand button', () => {
    renderDv(
      <DvFormFooter
        mode="edit"
        dirty
        primaryLabel="Save changes"
        onPrimary={() => {}}
        onSecondary={() => {}}
        onReset={() => {}}
        extraRight={<button type="button">Schedule for deletion</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Schedule for deletion' })).toBeInTheDocument();
  });
});

describe('DvFormPage', () => {
  it('shows the title, the close button and the announce text in a polite live region', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDv(
      <DvFormPage title="New campaign" onClose={onClose} announce="2 errors. Fix them to continue.">
        <p>content</p>
      </DvFormPage>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'New campaign' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 errors. Fix them to continue.');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focusFirstInvalid focuses the first aria-invalid field and does not navigate', () => {
    renderDv(
      <form>
        <input aria-label="ok" />
        <input aria-label="bad one" aria-invalid="true" />
        <input aria-label="bad two" aria-invalid="true" />
      </form>,
    );
    const el = focusFirstInvalid();
    expect(el).toBe(screen.getByLabelText('bad one'));
    expect(el).toHaveFocus();
  });

  it('focusFirstInvalid returns null when everything is valid', () => {
    renderDv(<input aria-label="fine" />);
    expect(focusFirstInvalid()).toBeNull();
  });
});

describe('DvStatusSelect', () => {
  function Harness({ initial, options }: { initial: EntityStatus; options: EntityStatus[] }) {
    const [v, setV] = useState(initial);
    return <DvStatusSelect value={v} options={options} onChange={setV} />;
  }

  it('defaults to Draft for new IO / LI and offers Draft and Active', async () => {
    const user = userEvent.setup();
    renderDv(<Harness initial="draft" options={['draft', 'active']} />);
    const button = screen.getByRole('button', { name: 'Status: Draft' });
    await user.click(button);
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/Draft$/);
    expect(items[1]).toHaveTextContent(/Active$/);
    await user.click(screen.getByRole('menuitem', { name: 'Active' }));
    expect(screen.getByRole('button', { name: 'Status: Active' })).toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    renderDv(
      <DvStatusSelect value="active" options={['active', 'paused']} onChange={() => {}} disabled />,
    );
    expect(screen.getByRole('button', { name: 'Status: Active' })).toBeDisabled();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('fires native change events on text fields', () => {
    const onChange = vi.fn();
    renderDv(<DvTextField label="Name" value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'z' } });
    expect(onChange).toHaveBeenCalledWith('z');
  });
});
