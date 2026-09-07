import { Controller, Get, Param } from "@nestjs/common";
import { Level, Roles } from "../../common/decorators/auth.decorators";

/** v1 analytics stubs: 200 + empty payloads so the web tabs render without errors.
 * Real aggregations can be layered in later (work-item counts by group/cycle/module). */
@Controller("api/workspaces/:slug")
@Level("WORKSPACE")
export class AnalyticsStubController {
  @Get("advance-analytics/:tab")
  @Roles("GUEST")
  tabData(@Param("tab") _tab: string): Record<string, unknown> {
    return { total: {}, filters: {}, empty: true };
  }

  @Get("advance-analytics-stats/:tab")
  @Roles("GUEST")
  stats(@Param("tab") _tab: string): Record<string, unknown> {
    return { count: 0, filter_count: 0 };
  }

  @Get("advance-analytics-charts/:graph")
  @Roles("GUEST")
  charts(@Param("graph") _graph: string): Record<string, unknown> {
    return { charts: [] };
  }
}
