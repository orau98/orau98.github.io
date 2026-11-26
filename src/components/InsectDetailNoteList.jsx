import { useId } from 'react';
import SourceCitation from './ui/SourceCitation';

export default function InsectDetailNoteList({ notes, isEnglish }) {
  const listId = useId();

  return (
    <ul className="divide-y divide-line pl-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
      {notes.map((note, index) => {
        const textId = `${listId}-${index}`;
        const endingId = `${textId}-ending`;
        const ending = note.content.match(/\b[A-Za-z][A-Za-z'-]{0,15}[.!?]{0,2}$/)?.[0]
          || Array.from(note.content).slice(-4).join('');
        const beginning = note.content.slice(0, note.content.length - ending.length);
        return (
          <li key={note.content} className="list-disc py-2 first:pt-0 last:pb-0">
            <SourceCitation
              sources={note.sources}
              isEnglish={isEnglish}
              collapsible
              describedBy={`${textId} ${endingId}`}
              renderInlineToggle={(toggle) => toggle ? (
                <>
                  <span id={textId}>{beginning}</span>
                  <span className="inline-block whitespace-nowrap">
                    <span id={endingId}>{ending}</span>{' '}{toggle}
                  </span>
                </>
              ) : note.content}
            />
          </li>
        );
      })}
    </ul>
  );
}
