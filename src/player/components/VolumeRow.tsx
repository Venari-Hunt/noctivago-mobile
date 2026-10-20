import { SliderRow } from '../../ui/SliderRow';

type Props = {
  label: string;
  value: number;
  /** Highest value; sounds go above 1 (a boost), master volume stops at 1. */
  max?: number;
  note?: string;
  disabled?: boolean;
  /** Turned off in the mix: dimmed, slider still works. */
  off?: boolean;
  onChange: (value: number) => void;
  /** Called once the finger lifts, to save the value. */
  onDone: (value: number) => void;
  /** Hold the name for options (sounds in a mix). */
  onLongPress?: () => void;
};

export function VolumeRow({ note, value, off, ...rest }: Props) {
  return <SliderRow {...rest} value={value} dim={off} text={note ?? `${Math.round(value * 100)}%`} />;
}
