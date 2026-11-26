import { useId } from 'react';
import SourceCitation from './ui/SourceCitation';

export default function InsectDetailNoteList({ notes, isEnglish }) {
  const listId = useId();

  return (
    <ul className="divide-y divide-line pl-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {notes.map((note, index) => {
        const textId = `${listId}-${index}`;
        return (
          <li key={note.content} className="list-disc py-2 first:pt-0 last:pb-0">
            <span id={textId}>{note.content}</span>
            {note.sources?.length > 0 && (
              <SourceCitation
                sources={note.sources}
                isEnglish={isEnglish}
                collapsible
                inlineToggle
                describedBy={textId}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
