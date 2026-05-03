// Hook tổng hợp cho mọi trang trong ứng dụng "So sánh giữa hai kỳ".
// Áp filters chung lên cả prev/curr, sau đó join và trả về toàn bộ
// kết quả tiền-tính-toán mà các trang cần.

import { useMemo } from 'react';
import { usePeriodStore } from '@/store/usePeriodStore';
import { applyFilters } from '@/store/useDataStore';
import {
  joinByLoan,
  joinByCustomer,
  compareKpi,
  rollCureRate,
  qualitySnapshot,
  par,
  lifecycleCounts,
  type LoanJoinResult,
  type CustomerJoinResult,
  type KpiDelta,
  type RollCureRates,
  type QualitySnapshot,
  type ParBreakdown,
  type LifecycleCounts,
} from '@/lib/period-compare';
import { isOpenLoan } from '@/lib/metrics';
import type { LoanRecord } from '@/lib/types';

export interface PeriodCompareSlice {
  prevRows: LoanRecord[];
  currRows: LoanRecord[];
  prevDate: Date | null;
  currDate: Date | null;
  loanJoin: LoanJoinResult;
  customerJoin: CustomerJoinResult;
  kpiDelta: KpiDelta;
  rollCure: RollCureRates;
  qualityPrev: QualitySnapshot;
  qualityCurr: QualitySnapshot;
  parPrev: ParBreakdown;
  parCurr: ParBreakdown;
  lifecycle: LifecycleCounts;
  hasData: boolean;
}

const EMPTY_RESULT: PeriodCompareSlice = {
  prevRows: [],
  currRows: [],
  prevDate: null,
  currDate: null,
  loanJoin: { joined: [], bothCount: 0, closedCount: 0, newCount: 0, collisions: 0 },
  customerJoin: { joined: [], retainedCount: 0, churnedCount: 0, newCount: 0, reactivatedCount: 0 },
  kpiDelta: {
    prev: {
      soKheUoc: 0,
      soKhachHang: 0,
      tongDuNo: 0,
      tongGiaiNgan: 0,
      duNoQuaHan: 0,
      tyLeNoQuaHan: 0,
      duNoKhoanh: 0,
      laiTonTH: 0,
      thuLaiTHThang: 0,
      laiSuatBQ: 0,
      mucVayBQ: 0,
    },
    curr: {
      soKheUoc: 0,
      soKhachHang: 0,
      tongDuNo: 0,
      tongGiaiNgan: 0,
      duNoQuaHan: 0,
      tyLeNoQuaHan: 0,
      duNoKhoanh: 0,
      laiTonTH: 0,
      thuLaiTHThang: 0,
      laiSuatBQ: 0,
      mucVayBQ: 0,
    },
    delta: {
      soKheUoc: 0,
      soKhachHang: 0,
      tongDuNo: 0,
      tongGiaiNgan: 0,
      duNoQuaHan: 0,
      tyLeNoQuaHan: 0,
      duNoKhoanh: 0,
      laiTonTH: 0,
      thuLaiTHThang: 0,
      laiSuatBQ: 0,
      mucVayBQ: 0,
    },
    pct: {
      soKheUoc: null,
      soKhachHang: null,
      tongDuNo: null,
      tongGiaiNgan: null,
      duNoQuaHan: null,
      tyLeNoQuaHan: null,
      duNoKhoanh: null,
      laiTonTH: null,
      thuLaiTHThang: null,
      laiSuatBQ: null,
      mucVayBQ: null,
    },
  },
  rollCure: { rollRate: 0, cureRate: 0, rollCount: 0, cureCount: 0, baseTrongHanT1: 0, baseQuaHanT1: 0 },
  qualityPrev: { trongHan: 0, quaHan: 0, khoanh: 0, total: 0 },
  qualityCurr: { trongHan: 0, quaHan: 0, khoanh: 0, total: 0 },
  parPrev: { par30: 0, par90: 0, par180: 0, par30Pct: 0, par90Pct: 0, par180Pct: 0, tongDuNo: 0 },
  parCurr: { par30: 0, par90: 0, par180: 0, par30Pct: 0, par90Pct: 0, par180Pct: 0, tongDuNo: 0 },
  lifecycle: {
    prevTotalLoans: 0,
    currTotalLoans: 0,
    retainedLoans: 0,
    closedLoans: 0,
    newLoans: 0,
    prevTotalCustomers: 0,
    currTotalCustomers: 0,
    retainedCustomers: 0,
    churnedCustomers: 0,
    newCustomers: 0,
    reactivatedCustomers: 0,
  },
  hasData: false,
};

export function usePeriodCompare(): PeriodCompareSlice {
  const prev = usePeriodStore((s) => s.prev);
  const curr = usePeriodStore((s) => s.curr);
  const filters = usePeriodStore((s) => s.filters);
  const ranges = usePeriodStore((s) => s.ranges);
  const search = usePeriodStore((s) => s.search);

  return useMemo(() => {
    if (!prev || !curr) return EMPTY_RESULT;
    // Loại khế ước có `tinhTrangMonVay` = Close hoặc rỗng khỏi toàn bộ
    // pipeline so sánh hai kỳ — các khế ước này không có ý nghĩa nghiệp
    // vụ (đã tất toán hoặc thiếu trạng thái) và làm sai số đếm vòng đời.
    const prevRows = applyFilters(prev.rows, filters, ranges, search).filter(isOpenLoan);
    const currRows = applyFilters(curr.rows, filters, ranges, search).filter(isOpenLoan);
    const loanJoin = joinByLoan(prevRows, currRows);
    const customerJoin = joinByCustomer(prevRows, currRows, prev.ngaySoLieu);
    const kpiDelta = compareKpi(prevRows, currRows);
    const rollCure = rollCureRate(loanJoin.joined);
    const qualityPrev = qualitySnapshot(prevRows);
    const qualityCurr = qualitySnapshot(currRows);
    const parPrev = par(prevRows);
    const parCurr = par(currRows);
    const lifecycle = lifecycleCounts(loanJoin, customerJoin, prevRows, currRows);
    return {
      prevRows,
      currRows,
      prevDate: prev.ngaySoLieu,
      currDate: curr.ngaySoLieu,
      loanJoin,
      customerJoin,
      kpiDelta,
      rollCure,
      qualityPrev,
      qualityCurr,
      parPrev,
      parCurr,
      lifecycle,
      hasData: true,
    };
  }, [prev, curr, filters, ranges, search]);
}
