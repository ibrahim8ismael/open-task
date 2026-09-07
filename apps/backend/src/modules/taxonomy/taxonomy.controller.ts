import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from "@nestjs/common";
import { Level, Roles } from "../../common/decorators/auth.decorators";
import {
  BulkCreateLabelsDto,
  CreateEstimateDto,
  CreateEstimatePointDto,
  CreateIssueTypeDto,
  CreateLabelDto,
  CreateStateDto,
  UpdateEstimatePointDto,
  UpdateLabelDto,
  UpdateStateDto,
} from "./dto/taxonomy.dto";
import { TaxonomyService } from "./taxonomy.service";

@Controller("api/workspaces/:slug/projects/:pid")
@Level("PROJECT")
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  // --- states ---

  @Get("states")
  @Roles("GUEST")
  states(@Param("slug") slug: string, @Param("pid") pid: string) {
    return this.taxonomy.listStates(slug, pid);
  }

  @Post("states")
  @Roles("MEMBER")
  createState(@Param("slug") slug: string, @Param("pid") pid: string, @Body() dto: CreateStateDto) {
    return this.taxonomy.createState(slug, pid, dto);
  }

  @Get("states/:sid")
  @Roles("GUEST")
  state(@Param("slug") slug: string, @Param("pid") pid: string, @Param("sid") sid: string) {
    return this.taxonomy.listStates(slug, pid, true).then((rows) => rows.find((r) => r.id === sid) ?? null);
  }

  @Put("states/:sid")
  @Roles("MEMBER")
  putState(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("sid") sid: string,
    @Body() dto: UpdateStateDto,
  ) {
    return this.taxonomy.updateState(slug, pid, sid, dto);
  }

  @Patch("states/:sid")
  @Roles("MEMBER")
  patchState(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("sid") sid: string,
    @Body() dto: UpdateStateDto,
  ) {
    return this.taxonomy.updateState(slug, pid, sid, dto);
  }

  @Delete("states/:sid")
  @Roles("ADMIN")
  deleteState(@Param("slug") slug: string, @Param("pid") pid: string, @Param("sid") sid: string) {
    return this.taxonomy.deleteState(slug, pid, sid);
  }

  @Post("states/:sid/mark-default")
  @Roles("ADMIN")
  markDefault(@Param("slug") slug: string, @Param("pid") pid: string, @Param("sid") sid: string) {
    return this.taxonomy.markDefault(slug, pid, sid);
  }

  @Get("intake-state")
  @Roles("GUEST")
  intakeStates(@Param("slug") slug: string, @Param("pid") pid: string) {
    return this.taxonomy.intakeStates(slug, pid);
  }

  // --- labels ---

  @Get("issue-labels")
  @Roles("GUEST")
  labels(@Param("slug") slug: string, @Param("pid") pid: string) {
    return this.taxonomy.listLabels(slug, pid);
  }

  @Post("issue-labels")
  @Roles("MEMBER")
  createLabel(@Param("slug") slug: string, @Param("pid") pid: string, @Body() dto: CreateLabelDto) {
    return this.taxonomy.createLabel(slug, pid, dto);
  }

  @Patch("issue-labels/:lid")
  @Roles("MEMBER")
  updateLabel(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("lid") lid: string,
    @Body() dto: UpdateLabelDto,
  ) {
    return this.taxonomy.updateLabel(slug, pid, lid, dto);
  }

  @Delete("issue-labels/:lid")
  @Roles("MEMBER")
  deleteLabel(@Param("slug") slug: string, @Param("pid") pid: string, @Param("lid") lid: string) {
    return this.taxonomy.deleteLabel(slug, pid, lid);
  }

  @Post("bulk-create-labels")
  @Roles("MEMBER")
  bulkCreateLabels(@Param("slug") slug: string, @Param("pid") pid: string, @Body() dto: BulkCreateLabelsDto) {
    return this.taxonomy.bulkCreateLabels(slug, pid, dto.labels ?? []);
  }

  // --- estimates ---

  @Get("estimates")
  @Roles("GUEST")
  estimates(@Param("slug") slug: string, @Param("pid") pid: string) {
    return this.taxonomy.listEstimates(slug, pid);
  }

  @Post("estimates")
  @Roles("MEMBER")
  createEstimate(@Param("slug") slug: string, @Param("pid") pid: string, @Body() dto: CreateEstimateDto) {
    return this.taxonomy.createEstimate(slug, pid, dto);
  }

  @Delete("estimates/:eid")
  @Roles("MEMBER")
  deleteEstimate(@Param("slug") slug: string, @Param("pid") pid: string, @Param("eid") eid: string) {
    return this.taxonomy.deleteEstimate(slug, pid, eid);
  }

  @Get("estimates/:eid/estimate-points")
  @Roles("GUEST")
  points(@Param("slug") slug: string, @Param("pid") pid: string, @Param("eid") eid: string) {
    return this.taxonomy.listPoints(slug, pid, eid);
  }

  @Post("estimates/:eid/estimate-points")
  @Roles("MEMBER")
  createPoint(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("eid") eid: string,
    @Body() dto: CreateEstimatePointDto,
  ) {
    return this.taxonomy.createPoint(slug, pid, eid, dto);
  }

  @Patch("estimates/:eid/estimate-points/:pointId")
  @Roles("MEMBER")
  updatePoint(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("eid") eid: string,
    @Param("pointId") pointId: string,
    @Body() dto: UpdateEstimatePointDto,
  ) {
    return this.taxonomy.updatePoint(slug, pid, eid, pointId, dto);
  }

  @Delete("estimates/:eid/estimate-points/:pointId")
  @Roles("MEMBER")
  deletePoint(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Param("eid") eid: string,
    @Param("pointId") pointId: string,
  ) {
    return this.taxonomy.deletePoint(slug, pid, eid, pointId);
  }

  // --- project issue types ---

  @Get("project-issue-types")
  @Roles("GUEST")
  projectIssueTypes(@Param("slug") slug: string, @Param("pid") pid: string) {
    return this.taxonomy.listProjectIssueTypes(slug, pid);
  }

  @Post("project-issue-types")
  @Roles("MEMBER")
  attachIssueType(
    @Param("slug") slug: string,
    @Param("pid") pid: string,
    @Body() dto: { issue_type_id: string },
  ) {
    return this.taxonomy.attachIssueType(slug, pid, dto.issue_type_id);
  }

  @Delete("project-issue-types/:linkId")
  @Roles("MEMBER")
  detachIssueType(@Param("slug") slug: string, @Param("pid") pid: string, @Param("linkId") linkId: string) {
    return this.taxonomy.detachIssueType(slug, pid, linkId);
  }
}

@Controller()
export class TaxonomyMiscController {
  constructor(private readonly taxonomy: TaxonomyService) {}

  @Get("api/workspaces/:slug/states")
  @Roles("GUEST")
  @Level("WORKSPACE")
  workspaceStates(@Param("slug") slug: string) {
    return this.taxonomy.workspaceStates(slug);
  }

  @Get("api/workspaces/:slug/labels")
  @Roles("GUEST")
  @Level("WORKSPACE")
  workspaceLabels(@Param("slug") slug: string) {
    return this.taxonomy.listLabels(slug);
  }

  @Get("api/workspaces/:slug/estimates")
  @Roles("GUEST")
  @Level("WORKSPACE")
  workspaceEstimates(@Param("slug") slug: string) {
    return this.taxonomy.listEstimates(slug);
  }

  @Get("api/workspaces/:slug/issue-types")
  @Roles("GUEST")
  @Level("WORKSPACE")
  issueTypes(@Param("slug") slug: string) {
    return this.taxonomy.listIssueTypes(slug);
  }

  @Post("api/workspaces/:slug/issue-types")
  @Roles("MEMBER")
  @Level("WORKSPACE")
  createIssueType(@Param("slug") slug: string, @Body() dto: CreateIssueTypeDto) {
    return this.taxonomy.createIssueType(slug, dto);
  }
}
