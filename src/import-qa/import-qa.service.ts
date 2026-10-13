import { Injectable, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export interface DateQaRow {
  workbook: string;
  sheet: string;
  row: string;
  column: string;
  rawValue: string;
  rawType: string;
  cleaned: string;
  flag: string;
  locationCode: string;
  companyName: string;
}

@Injectable()
export class ImportQaService {
  private outputRoot(): string {
    const candidates = [
      path.join(process.cwd(), 'scripts', 'migration-output'),
      path.join(process.cwd(), '..', 'scripts', 'migration-output'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return candidates[0];
  }

  getLatestRunId(): string | null {
    const ptr = path.join(this.outputRoot(), 'LATEST');
    if (!fs.existsSync(ptr)) return null;
    return fs.readFileSync(ptr, 'utf8').trim();
  }

  private runDir(runId?: string): string {
    const id = runId || this.getLatestRunId();
    if (!id) {
      throw new NotFoundException(
        'No migration QA run found. Run scripts/migrate-excel-clients.ts --qa-only first.',
      );
    }
    const dir = path.join(this.outputRoot(), id);
    if (!fs.existsSync(dir)) throw new NotFoundException(`Migration run not found: ${id}`);
    return dir;
  }

  getSummary(runId?: string) {
    const dir = this.runDir(runId);
    const summaryPath = path.join(dir, 'summary.json');
    const distPath = path.join(dir, 'distributions.json');
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const distributions = fs.existsSync(distPath)
      ? JSON.parse(fs.readFileSync(distPath, 'utf8'))
      : null;
    return {
      runId: path.basename(dir),
      summary,
      distributions,
      files: fs.readdirSync(dir).filter((f) => f.endsWith('.csv') || f.endsWith('.json')),
    };
  }

  listRuns(): string[] {
    const root = this.outputRoot();
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root)
      .filter((d) => d !== 'LATEST' && fs.statSync(path.join(root, d)).isDirectory())
      .sort()
      .reverse();
  }

  private splitCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  private matchesFilters(
    r: DateQaRow,
    opts: { locationCode?: string; sheet?: string; flag?: string; column?: string; q?: string },
  ): boolean {
    if (opts.locationCode && r.locationCode !== opts.locationCode) return false;
    if (opts.sheet && !(r.sheet || '').toLowerCase().includes(opts.sheet.toLowerCase())) return false;
    if (opts.flag && r.flag !== opts.flag) return false;
    if (opts.column && !(r.column || '').toLowerCase().includes(opts.column.toLowerCase())) return false;
    if (opts.q) {
      const q = opts.q.toLowerCase();
      if (
        !(r.companyName || '').toLowerCase().includes(q) &&
        !(r.rawValue || '').toLowerCase().includes(q) &&
        !(r.cleaned || '').toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  }

  private issueRank(flag: string): number {
    if (!flag || flag === 'DATE_OK') return 3;
    if (flag === 'DATE_COERCED_SERIAL' || flag === 'DATE_COERCED_TEXT') return 2;
    return 1;
  }

  async getDateQa(opts: {
    runId?: string;
    locationCode?: string;
    sheet?: string;
    flag?: string;
    column?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) {
    const dir = this.runDir(opts.runId);
    const csvPath = path.join(dir, 'date_qa.csv');
    if (!fs.existsSync(csvPath)) throw new NotFoundException('date_qa.csv missing for this run');

    const offset = opts.offset ?? 0;
    const limit = Math.min(opts.limit ?? 100, 500);
    // Default browse = issues only (avoids loading millions of OK/coerced rows)
    const defaultIssuesOnly = !opts.flag;

    const matched: DateQaRow[] = [];
    let total = 0;
    let headers: string[] = [];

    const rl = readline.createInterface({
      input: fs.createReadStream(csvPath, { encoding: 'utf8' }),
      crlfDelay: Infinity,
    });

    let first = true;
    for await (const line of rl) {
      if (!line) continue;
      if (first) {
        headers = this.splitCsvLine(line);
        first = false;
        continue;
      }
      const cols = this.splitCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h] = cols[i] ?? '';
      });
      const r = row as unknown as DateQaRow;
      if (!this.matchesFilters(r, opts)) continue;
      if (defaultIssuesOnly && this.issueRank(r.flag) !== 1) continue;
      total++;
      if (total > offset && matched.length < limit) {
        matched.push(r);
      }
    }

    return {
      runId: path.basename(dir),
      total,
      offset,
      limit,
      rows: matched,
    };
  }

  getCsvPath(filename: string, runId?: string): string {
    const allowed = new Set([
      'date_qa.csv',
      'field_qa.csv',
      'duplicates.csv',
      'quarantine_index.csv',
      'summary.json',
      'distributions.json',
    ]);
    if (!allowed.has(filename)) {
      throw new NotFoundException('File not allowed');
    }
    const dir = this.runDir(runId);
    const p = path.join(dir, filename);
    if (!fs.existsSync(p)) throw new NotFoundException(`${filename} not found`);
    return p;
  }
}
