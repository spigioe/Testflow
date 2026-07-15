using Microsoft.AspNetCore.Mvc;
using TestFlow.API.Data;
using TestFlow.API.Models;

namespace TestFlow.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SuitesController(SuiteRepository repo) : ControllerBase
{
    // GET /api/suites
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var suites = await repo.GetAllAsync();
        return Ok(suites);
    }

    // GET /api/suites/{id}
    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id)
    {
        var suite = await repo.GetByIdAsync(id);
        return suite is null ? NotFound() : Ok(suite);
    }

    // PUT /api/suites/{id}  ← upsert (create or update)
    [HttpPut("{id}")]
    public async Task<IActionResult> Upsert(string id, [FromBody] UpsertSuiteRequest req)
    {
        if (req.Id != id)
            return BadRequest("Az URL-beli ID nem egyezik a kérés törzsével.");

        await repo.UpsertAsync(req);
        return Ok(new { ok = true });
    }

    // DELETE /api/suites/{id}
    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await repo.DeleteAsync(id);
        return Ok(new { ok = true });
    }

    // POST /api/suites/reorder
    [HttpPost("reorder")]
    public async Task<IActionResult> Reorder([FromBody] ReorderRequest req)
    {
        await repo.ReorderAsync(req.Ids);
        return Ok(new { ok = true });
    }
}
