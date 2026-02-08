import asyncio
from neural_memory import Brain
from neural_memory.storage import InMemoryStorage
from neural_memory.engine.encoder import MemoryEncoder
from neural_memory.engine.retrieval import ReflexPipeline

class MemoryService:
    def __init__(self):
        self.brain = None
        self.storage = None
        self.encoder = None
        self.pipeline = None

    async def initialize(self):
        try:
            self.storage = InMemoryStorage()
            # Create a brain
            self.brain = Brain.create("viewchart_brain") 
            await self.storage.save_brain(self.brain)
            self.storage.set_brain(self.brain.id)
            
            # Initialize core components
            self.encoder = MemoryEncoder(self.storage, self.brain.config)
            self.pipeline = ReflexPipeline(self.storage, self.brain.config)
            print("[MEMORY] Initialized Neural Memory Service")
            return True
        except Exception as e:
            print(f"[MEMORY] Init failed: {e}")
            return False

    async def remember(self, content, mtype="observation"):
        if not self.encoder: return False
        try:
            text = f"[{mtype.upper()}] {content}" if mtype else content
            await self.encoder.encode(text)
            print(f"[MEMORY] Stored: {text}")
            return True
        except Exception as e:
            print(f"[MEMORY] Remember failed: {e}")
            return False

    async def recall(self, query):
        if not self.pipeline: return "Memory not ready"
        try:
            result = await self.pipeline.query(query)
            return result.context
        except Exception as e:
            print(f"[MEMORY] Recall failed: {e}")
            return f"Error: {e}"
